"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
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

export default function RecipientAddPage() {
  const { address, isConnected } = useAccount();
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const displayName = useMemo(() => {
    if (form.type === "individual") {
      return [form.firstName, form.lastName].filter(Boolean).join(" ");
    }
    return form.businessName;
  }, [form.firstName, form.lastName, form.businessName, form.type]);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetFeedback = useCallback(() => {
    setTimeout(() => setFeedback(""), 2500);
  }, []);

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
  }, [form, step, resetFeedback]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, [validateStep]);

  const handleBack = useCallback(() => {
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

      setFeedback("Recipient saved");
      setForm(emptyForm);
      setStep(1);
      resetFeedback();
    } catch (error) {
      console.error(error);
      setFeedback(error.message);
      resetFeedback();
    } finally {
      setSubmitting(false);
    }
  }, [address, form, isConnected, resetFeedback, validateStep]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
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
        );
      case 2:
        return (
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
        );
      case 3:
        return (
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
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Account type
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {accountTypes.map((accountType) => (
                  <Button
                    key={accountType}
                    variant={form.accountType === accountType ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => updateForm("accountType", accountType)}
                  >
                    {accountType}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="flex w-full justify-end lg:flex-1">
      <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
        <CardContent className="space-y-6 px-6 pb-2">

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full border">
              <Link href="/app/recipient">←</Link>
            </Button>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Recipient</p>
              <h1 className="text-lg font-semibold">
                {step === 1 ? "Payee profile" : step === 2 ? "Contact details" : "Bank details"}
              </h1>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4">
            {renderStepContent()}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={handleBack}
              disabled={step === 1 || submitting}
            >
              Back
            </Button>
            {step < TOTAL_STEPS ? (
              <Button size="lg" className="flex-1 rounded-full" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button
                size="lg"
                className="flex-1 rounded-full"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save recipient"}
              </Button>
            )}
          </div>

          {feedback ? (
            <p className="text-center text-[11px] text-muted-foreground">{feedback}</p>
          ) : null}
          <p className="text-center text-[11px] text-muted-foreground">
            Recipient name: {displayName || "—"}
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
