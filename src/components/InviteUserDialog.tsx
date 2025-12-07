// src/components/InviteUserDialog.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  companyId: string;
  accessToken: string; // pass supabase session access token
}

export const InviteUserDialog: React.FC<Props> = ({
  companyId,
  accessToken,
}) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      alert("Company id missing");
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/create-invite`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId,
          inviteEmail: email,
          inviteName: name,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { raw: text };
      }

      console.log("create-invite response:", res.status, data);

      if (!res.ok || data?.success === false) {
        const msg =
          data?.error ||
          data?.message ||
          data?.raw ||
          `Invite failed with status ${res.status}`;
        alert("Invite failed: " + msg);
        if (data?.inviteLink) {
          console.log("Manual invite link:", data.inviteLink);
          setLastInviteLink(data.inviteLink);
        }
        return;
      }

      // success
      if (data?.inviteLink) {
        setLastInviteLink(data.inviteLink);
      }

      setEmail("");
      setName("");
      alert("Invite sent.");
    } catch (err: any) {
      console.error("invite_error", err);
      alert("Invite failed: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!lastInviteLink) return;
    navigator.clipboard
      .writeText(lastInviteLink)
      .then(() => alert("Invite link copied"))
      .catch(() => alert("Failed to copy invite link"));
  }

  return (
    <div className="space-y-4">
      {/* FORM SECTION */}
      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-3 items-stretch"
      >
        <div className="flex flex-col gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            type="email"
            required
            className="w-full"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional name"
            type="text"
            className="w-full"
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Invite"}
          </Button>
        </div>
      </form>

      {/* LAST INVITE LINK + COPY BUTTON BELOW INPUTS */}
      {lastInviteLink && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Last invite link:</span>
          <div className="flex items-center gap-2">
            <a
              href={lastInviteLink}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline break-all"
            >
              {lastInviteLink}
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteUserDialog;