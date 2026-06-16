"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Save, Star, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StaffRow, StaffSkillEvaluationRow } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

import { formatDate, formatMoney } from "../_lib/formatters";
import { runGiaPhuAction } from "../_lib/giaphu-erp-api";

type StaffProfileDraft = {
  id: string;
  name: string;
  team: string;
  position: string;
  salaryDay: string;
  resigned: string;
  offDate: string;
  avatarUrl: string;
  profileFiles: string;
  birthYear: string;
  phone: string;
  citizenId: string;
  hometown: string;
  currentAddress: string;
  mainSkill: string;
  internalLevel: string;
  referrer: string;
  expectedStability: string;
  ranking: string;
  startDate: string;
  note: string;
};

type CriterionDraft = Record<string, { score: number; note: string }>;

type StaffDetailManagerProps = {
  staff: StaffRow;
  skillEvaluations: StaffSkillEvaluationRow[];
};

const internalLevels = ["1", "2", "3", "4", "5"];
const stabilityOptions = ["Ổn định", "Theo dõi", "Không ổn định"];
const rankOptions = ["Hạng A", "Hạng B", "Hạng C", "Cần kèm"];
const travelOptions = ["Không", "Có"];
const statusOptions = ["Còn làm", "Tạm nghỉ", "Nghỉ việc", "Không gọi lại"];

const criteria = [
  { key: "xayTo", title: "Xây tô", description: "Tường thẳng, mặt phẳng, cạnh sắc, ít hao vật tư." },
  { key: "canNen", title: "Cán nền", description: "Biết cao độ, độ dốc, mặt nền đều và chắc." },
  { key: "opLat", title: "Ốp lát", description: "Ron đều, mặt phẳng, xử lý góc và mí tốt." },
  { key: "coppha", title: "GCLĐ coppha", description: "Lắp dựng chắc, đúng kích thước, tháo lắp gọn." },
  { key: "cotThep", title: "GCLĐ cốt thép", description: "Buộc thép chắc, đúng cấu tạo, đúng khoảng cách." },
  { key: "docBanVe", title: "Đọc bản vẽ", description: "Hiểu mặt bằng, mặt cắt, chi tiết, ít làm sai." },
  {
    key: "namBatCongViec",
    title: "Nắm bắt công việc",
    description: "Giao việc nhanh hiểu, chủ động xử lý tại hiện trường.",
  },
  { key: "chatLuong", title: "Chất lượng hoàn thiện", description: "Sạch việc, đều tay, ít lỗi phải sửa lại." },
  { key: "kyLuat", title: "Kỷ luật", description: "Đúng giờ, ít nghỉ ngang, tuân thủ chỉ huy." },
  { key: "onDinh", title: "Ổn định", description: "Đi làm đều, giữ cam kết, không bỏ đội giữa chừng." },
  { key: "phoiHop", title: "Phối hợp đội nhóm", description: "Dễ làm việc, không gây xung đột, hỗ trợ anh em." },
  { key: "anToan", title: "An toàn lao động", description: "Biết giữ an toàn, dùng đồ bảo hộ, ít tạo rủi ro." },
];

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function initialProfile(staff: StaffRow): StaffProfileDraft {
  return {
    id: staff.id,
    name: staff.name,
    team: staff.team,
    position: staff.position,
    salaryDay: String(staff.salaryDay || ""),
    resigned: staff.resigned ? "true" : "false",
    offDate: staff.offDate || "",
    avatarUrl: staff.avatarUrl || "",
    profileFiles: staff.profileFiles || "",
    birthYear: staff.birthYear || "",
    phone: staff.phone || "",
    citizenId: staff.citizenId || "",
    hometown: staff.hometown || "",
    currentAddress: staff.currentAddress || "",
    mainSkill: staff.mainSkill || "",
    internalLevel: staff.internalLevel || "3",
    referrer: staff.referrer || "",
    expectedStability: staff.expectedStability || "",
    ranking: staff.ranking || "",
    startDate: staff.startDate || "",
    note: staff.note || "",
  };
}

function initialCriteria(): CriterionDraft {
  return Object.fromEntries(criteria.map((item) => [item.key, { score: 0, note: "" }]));
}

function scoreRank(totalScore: number, maxScore: number) {
  if (maxScore <= 0) return "Chưa đánh giá";
  const ratio = totalScore / maxScore;
  if (ratio >= 0.9) return "Hạng A";
  if (ratio >= 0.75) return "Hạng B";
  if (ratio >= 0.6) return "Hạng C";
  return "Cần kèm";
}

export function StaffDetailManager({ staff, skillEvaluations }: StaffDetailManagerProps) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<StaffProfileDraft>(() => initialProfile(staff));
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingEvaluation, setSavingEvaluation] = React.useState(false);
  const [evaluationDate, setEvaluationDate] = React.useState(todayValue);
  const [evaluator, setEvaluator] = React.useState("");
  const [travelReady, setTravelReady] = React.useState("Không");
  const [statusAfterReview, setStatusAfterReview] = React.useState("Còn làm");
  const [leaveDate, setLeaveDate] = React.useState("");
  const [criteriaDraft, setCriteriaDraft] = React.useState<CriterionDraft>(() => initialCriteria());
  const [summaryNote, setSummaryNote] = React.useState("");
  const [newSalary, setNewSalary] = React.useState("");

  React.useEffect(() => {
    setProfile(initialProfile(staff));
  }, [staff]);

  const totalScore = React.useMemo(
    () => Object.values(criteriaDraft).reduce((sum, item) => sum + Number(item.score || 0), 0),
    [criteriaDraft],
  );
  const maxScore = criteria.length * 5;
  const rank = scoreRank(totalScore, maxScore);
  const scoredCount = Object.values(criteriaDraft).filter((item) => item.score > 0).length;

  function updateProfile(key: keyof StaffProfileDraft, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateCriterionScore(key: string, score: number) {
    setCriteriaDraft((current) => ({ ...current, [key]: { ...(current[key] ?? { note: "" }), score } }));
  }

  function updateCriterionNote(key: string, note: string) {
    setCriteriaDraft((current) => ({ ...current, [key]: { ...(current[key] ?? { score: 0 }), note } }));
  }

  async function saveProfile() {
    if (!profile.name.trim()) {
      toast.error("Vui lòng nhập họ tên công nhân.");
      return;
    }

    setSavingProfile(true);
    try {
      await runGiaPhuAction("saveStaffProfile", {
        ...profile,
        salaryDay: profile.salaryDay,
        resigned: profile.resigned === "true",
      });
      toast.success("Đã lưu hồ sơ công nhân.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được hồ sơ công nhân.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveEvaluation() {
    if (!evaluationDate) {
      toast.error("Vui lòng chọn ngày đánh giá.");
      return;
    }
    if (newSalary.trim() && Number(newSalary) < 0) {
      toast.error("Mức lương mới không được âm.");
      return;
    }

    setSavingEvaluation(true);
    try {
      await runGiaPhuAction("saveStaffSkillEvaluation", {
        staffId: staff.id,
        evaluationDate,
        evaluator,
        travelReady,
        statusAfterReview,
        leaveDate,
        criteria: criteriaDraft,
        summaryNote,
        newSalary,
      });
      toast.success("Đã lưu đánh giá tay nghề.");
      setCriteriaDraft(initialCriteria());
      setSummaryNote("");
      setNewSalary("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được đánh giá tay nghề.");
    } finally {
      setSavingEvaluation(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Hồ sơ công nhân</CardTitle>
              <p className="mt-1 text-muted-foreground text-sm">
                Quản lý thông tin nền, tay nghề, hồ sơ và ghi chú nội bộ.
              </p>
            </div>
            <Badge variant="secondary">{staff.resigned ? "Đã nghỉ việc" : "Đang làm"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border bg-muted text-center text-muted-foreground text-sm">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={profile.name || "Ảnh công nhân"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="space-y-1">
                  <UserRound className="mx-auto size-6" />
                  <div>Ảnh công nhân</div>
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Avatar công nhân"
                value={profile.avatarUrl}
                placeholder="Dán link ảnh hoặc tên file"
                onChange={(value) => updateProfile("avatarUrl", value)}
              />
              <TextField
                label="Upload hồ sơ vào root folder"
                value={profile.profileFiles}
                placeholder="Dán link/tên hồ sơ, mỗi dòng một file"
                onChange={(value) => updateProfile("profileFiles", value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <TextField
              required
              label="Họ tên"
              value={profile.name}
              placeholder="Ví dụ: Nguyễn Văn A"
              onChange={(value) => updateProfile("name", value)}
            />
            <TextField
              label="Năm sinh"
              value={profile.birthYear}
              placeholder="Ví dụ: 1988"
              onChange={(value) => updateProfile("birthYear", value)}
            />
            <TextField
              label="Số điện thoại"
              value={profile.phone}
              placeholder="Ví dụ: 09xx..."
              onChange={(value) => updateProfile("phone", value)}
            />
            <TextField
              label="CCCD"
              value={profile.citizenId}
              placeholder="Số căn cước nếu có"
              onChange={(value) => updateProfile("citizenId", value)}
            />
            <TextField
              label="Quê quán"
              value={profile.hometown}
              placeholder="Tỉnh / huyện"
              onChange={(value) => updateProfile("hometown", value)}
            />
            <TextField
              label="Địa chỉ hiện tại"
              value={profile.currentAddress}
              placeholder="Nơi ở hiện tại"
              onChange={(value) => updateProfile("currentAddress", value)}
            />
            <TextField
              label="Nhóm thợ"
              value={profile.team}
              placeholder="Chọn hoặc nhập nhóm"
              onChange={(value) => updateProfile("team", value)}
            />
            <TextField
              label="Tay nghề chính"
              value={profile.mainSkill}
              placeholder="Ví dụ: Xây tô / Ốp lát"
              onChange={(value) => updateProfile("mainSkill", value)}
            />
            <SelectField
              label="Bậc thợ nội bộ"
              value={profile.internalLevel}
              options={internalLevels}
              onChange={(value) => updateProfile("internalLevel", value)}
            />
            <TextField
              label="Đơn giá ngày"
              type="number"
              value={profile.salaryDay}
              placeholder="Ví dụ: 450000"
              onChange={(value) => updateProfile("salaryDay", value)}
            />
            <TextField
              label="Người giới thiệu"
              value={profile.referrer}
              placeholder="Cai thầu / tổ trưởng / nguồn giới thiệu"
              onChange={(value) => updateProfile("referrer", value)}
            />
            <SelectField
              label="Tính ổn định dự kiến"
              value={profile.expectedStability}
              options={stabilityOptions}
              placeholder="Chọn"
              onChange={(value) => updateProfile("expectedStability", value)}
            />
            <SelectField
              label="Xếp đội"
              value={profile.ranking}
              options={rankOptions}
              placeholder="Chọn"
              onChange={(value) => updateProfile("ranking", value)}
            />
            <TextField
              label="Ngày vào làm"
              type="date"
              value={profile.startDate}
              helper="Dùng để tính thâm niên, lọc công nhân lâu năm và xét chính sách hỗ trợ."
              onChange={(value) => updateProfile("startDate", value)}
            />
            <SelectField
              label="Trạng thái"
              value={profile.resigned}
              options={[
                { label: "Đang làm", value: "false" },
                { label: "Đã nghỉ việc", value: "true" },
              ]}
              onChange={(value) => updateProfile("resigned", value)}
            />
            {profile.resigned === "true" ? (
              <TextField
                label="Thời gian nghỉ"
                type="date"
                value={profile.offDate}
                onChange={(value) => updateProfile("offDate", value)}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea
              value={profile.note}
              onChange={(event) => updateProfile("note", event.target.value)}
              placeholder="Điểm mạnh, điểm yếu, lưu ý khi giao việc..."
              className="min-h-24"
            />
          </div>

          <Button onClick={saveProfile} disabled={savingProfile}>
            <Save className="size-4" />
            {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đánh giá tay nghề & nhận xét thực chiến</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <TextField label="Ngày đánh giá" type="date" value={evaluationDate} onChange={setEvaluationDate} />
            <TextField label="Chọn công nhân" value={staff.name} disabled onChange={() => undefined} />
            <TextField
              label="Người đánh giá"
              value={evaluator}
              placeholder="Ví dụ: Hải / Cai thầu / Chỉ huy"
              onChange={setEvaluator}
            />
            <SelectField
              label="Có đi làm xa không?"
              value={travelReady}
              options={travelOptions}
              onChange={setTravelReady}
            />
            <SelectField
              label="Trạng thái sau đánh giá"
              value={statusAfterReview}
              options={statusOptions}
              onChange={setStatusAfterReview}
            />
            <TextField
              label="Thời gian nghỉ / ngày nghỉ việc"
              type="date"
              value={leaveDate}
              helper="Chỉ nhập khi công nhân tạm nghỉ, nghỉ việc hoặc không gọi lại."
              onChange={setLeaveDate}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {criteria.map((item) => {
              const draft = criteriaDraft[item.key] ?? { score: 0, note: "" };
              return (
                <div key={item.key} className="rounded-2xl border p-4">
                  <div className="font-semibold text-sm">{item.title}</div>
                  <p className="mt-1 min-h-9 text-muted-foreground text-xs">{item.description}</p>
                  <div className="mt-4 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className="text-muted-foreground transition hover:text-amber-500"
                        onClick={() => updateCriterionScore(item.key, score)}
                        aria-label={`${item.title} ${score} sao`}
                      >
                        <Star className={cn("size-5", score <= draft.score && "fill-amber-500 text-amber-500")} />
                      </button>
                    ))}
                    <span className="ml-2 font-medium text-xs">{draft.score}/5</span>
                  </div>
                  <Textarea
                    value={draft.note}
                    onChange={(event) => updateCriterionNote(item.key, event.target.value)}
                    placeholder="Nhập nhận xét sau khi chấm sao..."
                    className="mt-3 min-h-20"
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label>Ghi chú đánh giá tổng hợp</Label>
            <Textarea
              value={summaryNote}
              onChange={(event) => setSummaryNote(event.target.value)}
              placeholder="Kết luận ngắn: nên giao việc gì, điểm mạnh/yếu, lưu ý khi gọi đi công trình..."
              className="min-h-20"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Mức lương mới"
              type="number"
              value={newSalary}
              placeholder="Ví dụ: 450000"
              helper="Nhập khi cần cập nhật đơn giá sau đánh giá."
              onChange={setNewSalary}
            />
            <div className="rounded-2xl border border-dashed p-4 text-sm">
              <div className="font-semibold">Luồng lương</div>
              <p className="mt-2 text-muted-foreground">
                Nếu nhập mức lương mới, hệ thống sẽ cập nhật Đơn giá ngày trong hồ sơ công nhân.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed p-4 text-sm">
            <span className="font-semibold">
              Điểm dự kiến: {totalScore}/{maxScore} · {rank}
            </span>
            <div className="mt-1 text-muted-foreground">
              Đã chấm {scoredCount}/{criteria.length} nhóm năng lực. Ô nhận xét dưới sao là cơ sở để giao việc đúng
              người.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveEvaluation} disabled={savingEvaluation}>
              <Save className="size-4" />
              {savingEvaluation ? "Đang lưu..." : "Lưu đánh giá"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCriteriaDraft(initialCriteria())}
              disabled={savingEvaluation}
            >
              Làm mới đánh giá
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử đánh giá tay nghề</CardTitle>
        </CardHeader>
        <CardContent>
          {skillEvaluations.length ? (
            <div className="grid gap-3">
              {skillEvaluations.slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-xl border p-4 text-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold">
                      {formatDate(row.date)} · {row.rank || "Chưa xếp hạng"}
                    </div>
                    <Badge variant="outline">{row.totalScore}/60 điểm</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-3">
                    <div>Người đánh giá: {row.evaluator || "-"}</div>
                    <div>Trạng thái: {row.statusAfterReview || "-"}</div>
                    <div>Lương mới: {row.newSalary ? formatMoney(row.newSalary) : "-"}</div>
                  </div>
                  {row.summaryNote ? <p className="mt-2 text-muted-foreground">{row.summaryNote}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              Chưa có đánh giá tay nghề cho công nhân này.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  helper,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper ? <p className="text-muted-foreground text-xs">{helper}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Chọn",
}: {
  label: string;
  value: string;
  options: Array<string | { label: string; value: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const item = typeof option === "string" ? { label: option, value: option } : option;
            return (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
