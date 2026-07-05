"use client";

import { useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Step = "phone" | "code" | "password";

type ConnectFormProps = {
  onConnected: (info: { displayName: string; username: string }) => void;
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status !== "success") {
    throw new Error(json.message || "Có lỗi xảy ra.");
  }
  return json.data;
}

export function ConnectForm({ onConnected }: ConnectFormProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!phoneNumber.trim() || loading) return;
    setLoading(true);
    try {
      await postJson("/api/telegram/send-code", { phoneNumber: phoneNumber.trim() });
      setStep("code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    try {
      const data = await postJson("/api/telegram/submit-code", { code: code.trim() });
      if (data.step === "password") {
        setStep("password");
      } else {
        onConnected({ displayName: data.displayName ?? "", username: data.username ?? "" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    try {
      const data = await postJson("/api/telegram/submit-password", { password });
      onConnected({ displayName: data.displayName ?? "", username: data.username ?? "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center gap-4 p-4 text-white">
      <p className="text-center text-sm text-white/55">
        Đăng nhập tài khoản Telegram cá nhân để xem nhanh tin nhắn ngay trong ERP.
      </p>

      {step === "phone" ? (
        <form className="flex flex-col gap-2" onSubmit={handleSendCode}>
          <Input
            className="h-11 rounded-2xl border-white/10 bg-white/6 px-4 text-white placeholder:text-white/35 focus-visible:border-[#26A5E4] focus-visible:ring-[#26A5E4]/20"
            type="tel"
            placeholder="+84 901 234 567"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            disabled={loading}
            autoFocus
          />
          <Button
            type="submit"
            className="h-11 rounded-2xl border-0 bg-[#26A5E4] text-white hover:bg-[#1d93cd]"
            disabled={loading}
          >
            {loading ? <Spinner /> : "Gửi mã xác thực"}
          </Button>
        </form>
      ) : null}

      {step === "code" ? (
        <form className="flex flex-col gap-2" onSubmit={handleSubmitCode}>
          <p className="text-xs text-white/45">Nhập mã Telegram vừa gửi tới {phoneNumber}.</p>
          <Input
            className="h-11 rounded-2xl border-white/10 bg-white/6 px-4 text-white placeholder:text-white/35 focus-visible:border-[#26A5E4] focus-visible:ring-[#26A5E4]/20"
            inputMode="numeric"
            placeholder="Mã xác thực"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={loading}
            autoFocus
          />
          <Button
            type="submit"
            className="h-11 rounded-2xl border-0 bg-[#26A5E4] text-white hover:bg-[#1d93cd]"
            disabled={loading}
          >
            {loading ? <Spinner /> : "Xác nhận"}
          </Button>
        </form>
      ) : null}

      {step === "password" ? (
        <form className="flex flex-col gap-2" onSubmit={handleSubmitPassword}>
          <p className="text-xs text-white/45">Tài khoản có bật xác thực 2 lớp, vui lòng nhập mật khẩu.</p>
          <Input
            className="h-11 rounded-2xl border-white/10 bg-white/6 px-4 text-white placeholder:text-white/35 focus-visible:border-[#26A5E4] focus-visible:ring-[#26A5E4]/20"
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            autoFocus
          />
          <Button
            type="submit"
            className="h-11 rounded-2xl border-0 bg-[#26A5E4] text-white hover:bg-[#1d93cd]"
            disabled={loading}
          >
            {loading ? <Spinner /> : "Xác nhận"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
