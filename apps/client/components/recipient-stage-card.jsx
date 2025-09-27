"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FlowSteps } from "@/components/flow-steps";

const accountTypes = ["Savings", "Current", "NRE", "NRO", "Other"];

const emptyForm = {
  type: "individual",
  firstName: "",
  lastName: "",
  businessName: "",
  email: "",
  phone: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
  accountHolder: "",
  branch: "",
  accountType: "",
};

const TOTAL_STEPS = 3;

export function RecipientStageCard({
  onBack,
  onRecipientSelected,
  onRecipientCreated,
  showSteps = true,
}) {
  const { address, isConnected } = useAccount();

  const [view, setView] = useState("list");
  const [recipients, setRecipients] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setStep(1);
    setFeedback("");
  }, []);

  const resetFeedback = useCallback(() => {
    setTimeout(() => setFeedback(""), 2500);
  }, []);

  const loadRecipients = useCallback(async () => {
    if (!isConnected || !address) {
      setRecipients([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`/api/recipients?walletAddress=${address}`);
      if (!response.ok) {
        throw new Error("Failed to fetch recipients");
      }
      const data = await response.json();
      setRecipients(data.recipients ?? []);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("Unable to load recipients");
    }
  }, [address, isConnected]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const displayName = useMemo(() => {
    if (form.type === "individual") {
      return [form.firstName, form.lastName].filter(Boolean).join(" ");
    }
    return form.businessName;
  }, [form.businessName, form.firstName, form.lastName, form.type]);

  const validateStep = useCallback(() => {
    if (step === 1) {
      if (form.type === "individual") {
        if (!form.firstName && !form.lastName) {
          setFeedback("Add at least a first or last name.");
          resetFeedback();
          return false;
        }
      } else if (!form.businessName) {
        setFeedback("Business name is required.");
        resetFeedback();
        return false;
      }
    }

    if (step === 3) {
      const required = [
        { field: "accountNumber", label: "account number" },
        { field: "ifsc", label: "IFSC code" },
        { field: "bankName", label: "bank name" },
        { field: "accountHolder", label: "account holder" },
      ];
      for (const { field, label } of required) {
        if (!form[field]) {
          setFeedback(`Please add ${label}.`);
          resetFeedback();
          return false;
        }
      }
      if (!form.accountType) {
        setFeedback("Select an account type.");
        resetFeedback();
        return false;
      }
    }

    return true;
  }, [form, resetFeedback, step]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, [validateStep]);

  const handleBackStep = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;
    if (!isConnected || !address) {
      setFeedback("Connect your wallet first.");
      resetFeedback();
      return;
    }

    const payload = {
      ...form,
      walletAddress: address,
      accountType: form.accountType || "Other",
    };

    try {
      setSubmitting(true);
      const response = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save recipient");
      }

      const data = await response.json();
      setFeedback(`Recipient ${displayName || "saved"} added.`);
      resetFeedback();
      resetForm();
      setView("list");
      setSelectedId(data.recipient?.id ?? null);
      void loadRecipients();
      onRecipientCreated?.(data.recipient);
    } catch (error) {
      console.error(error);
      setFeedback(error.message);
      resetFeedback();
    } finally {
      setSubmitting(false);
    }
  }, [address, displayName, form, isConnected, loadRecipients, onRecipientCreated, resetFeedback, resetForm, validateStep]);

  const handleSelect = useCallback(() => {
    if (!selectedId) return;
    const selected = recipients.find((recipient) => recipient.id === selectedId);
    if (!selected) return;
    onRecipientSelected?.(selected);
  }, [onRecipientSelected, recipients, selectedId]);

  const renderList = () => (
    <>
      <div className="flex items-center gap-3">
        {onBack ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border" onClick={onBack}>
            ←
          </Button>
        ) : null}
        <div className="flex flex-1 items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Recipients</p>
            <h1 className="text-lg font-semibold">Saved payees</h1>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => setView("form")}>
            Add
          </Button>
        </div>
      </div>

      <Separator className="bg-border" />

      {!isConnected ? (
        <p className="text-sm text-muted-foreground">Connect your wallet to view recipients linked to this address.</p>
      ) : status === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading recipients…</p>
      ) : status === "error" ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recipients saved yet. Add one to reuse bank details quickly.</p>
      ) : (
        <ul className="space-y-3">
          {recipients.map((recipient) => {
            const isSelected = selectedId === recipient.id;
            return (
              <li key={recipient.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(recipient.id)}
                  className={`w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left text-xs transition ${
                    isSelected ? "border-primary bg-primary/10" : "bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-card-foreground">
                      {recipient.type === "INDIVIDUAL"
                        ? [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || "Individual"
                        : recipient.businessName || "Business"}
                    </span>
                    <span className="text-[11px] uppercase text-primary">{recipient.accountType}</span>
                  </div>
                  <div className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
                    <span>{recipient.bankName}</span>
                    <span>Account: {recipient.accountNumber}</span>
                    <span>IFSC: {recipient.ifsc}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const renderForm = () => (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full border"
          onClick={() => {
            resetForm();
            setView("list");
          }}
        >
          ←
        </Button>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add recipient</p>
          <h1 className="text-lg font-semibold">{displayName || "New recipient"}</h1>
        </div>
      </div>

      <Separator className="bg-border" />

      <div className="space-y-4">
        {step === 1 ? (
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Payee type</Label>
            <div className="flex items-center gap-2">
              {["individual", "business"].map((option) => (
                <Button
                  key={option}
                  variant={form.type === option ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => updateForm("type", option)}
                >
                  {option === "individual" ? "Individual" : "Business"}
                </Button>
              ))}
            </div>

            {form.type === "individual" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-xs font-semibold uppercase text-muted-foreground">
                    First name
                  </Label>
                  <Input
                    id="first-name"
                    value={form.firstName}
                    onChange={(event) => updateForm("firstName", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-xs font-semibold uppercase text-muted-foreground">
                    Last name
                  </Label>
                  <Input
                    id="last-name"
                    value={form.lastName}
                    onChange={(event) => updateForm("lastName", event.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="business-name" className="text-xs font-semibold uppercase text-muted-foreground">
                  Business name
                </Label>
                <Input
                  id="business-name"
                  value={form.businessName}
                  onChange={(event) => updateForm("businessName", event.target.value)}
                />
              </div>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase text-muted-foreground">
                Phone
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-number" className="text-xs font-semibold uppercase text-muted-foreground">
                Account number
              </Label>
              <Input
                id="account-number"
                value={form.accountNumber}
                onChange={(event) => updateForm("accountNumber", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ifsc" className="text-xs font-semibold uppercase text-muted-foreground">
                IFSC code
              </Label>
              <Input
                id="ifsc"
                value={form.ifsc}
                onChange={(event) => updateForm("ifsc", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-name" className="text-xs font-semibold uppercase text-muted-foreground">
                Bank name
              </Label>
              <Input
                id="bank-name"
                value={form.bankName}
                onChange={(event) => updateForm("bankName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-holder" className="text-xs font-semibold uppercase text-muted-foreground">
                Account holder name
              </Label>
              <Input
                id="account-holder"
                value={form.accountHolder}
                onChange={(event) => updateForm("accountHolder", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch" className="text-xs font-semibold uppercase text-muted-foreground">
                Branch
              </Label>
              <Input
                id="branch"
                value={form.branch}
                onChange={(event) => updateForm("branch", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Account type</Label>
              <div className="flex flex-wrap items-center gap-2">
                {accountTypes.map((type) => (
                  <Button
                    key={type}
                    variant={form.accountType === type ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => updateForm("accountType", type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
      <CardContent className="space-y-6 px-6 pb-2">
        {showSteps ? <FlowSteps current={view === "form" ? 3 : 3} /> : null}
        {view === "list" ? renderList() : renderForm()}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 px-6 pb-6">
        {view === "list" ? (
          <>
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={handleSelect}
              disabled={!isConnected || !selectedId}
            >
              {selectedId ? "Use this recipient" : "Select a recipient"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setView("form")}
              disabled={!isConnected}
            >
              Add new recipient
            </Button>
            {error ? <p className="text-center text-[11px] text-destructive">{error}</p> : null}
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" className="rounded-full" onClick={handleBackStep} disabled={step === 1}>
              Back
            </Button>
            {step === TOTAL_STEPS ? (
              <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving…" : "Save recipient"}
              </Button>
            ) : (
              <Button className="rounded-full" onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        )}
        {feedback ? <p className="text-center text-[11px] text-muted-foreground">{feedback}</p> : null}
      </CardFooter>
    </Card>
  );
}
