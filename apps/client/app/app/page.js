"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChainId, useAccount, useDisconnect, useSwitchChain, useReadContract, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SEPOLIA_CHAIN_ID, CENTRAL_WALLET_ADDRESS, PYUSD_DECIMALS, PYUSD_TOKEN_ADDRESS } from "@/lib/constants";
const DEFAULT_SEND_AMOUNT = "1.15";
const REFRESH_INTERVAL_MS = 60_000;

const accountTypes = ["Savings", "Current", "NRE", "NRO", "Other"];

const emptyRecipientForm = {
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

const TOTAL_RECIPIENT_STEPS = 3;

export default function QuotePage() {
  const [stage, setStage] = useState("quote"); // quote | recipient | recipientForm | payment | confirm
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const switchAttemptedRef = useRef(false);
  const feedbackTimeoutRef = useRef(null);

  const [recipients, setRecipients] = useState([]);
  const [recipientStatus, setRecipientStatus] = useState("idle");
  const [recipientError, setRecipientError] = useState("");
  const [recipientForm, setRecipientForm] = useState(emptyRecipientForm);
  const [recipientFeedback, setRecipientFeedback] = useState("");
  const [recipientSubmitting, setRecipientSubmitting] = useState(false);
  const [recipientStep, setRecipientStep] = useState(1);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [paymentPurpose, setPaymentPurpose] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const isWrongChain = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  // Central wallet ABI (views only)
  const centralWalletAbi = [
    {
      name: "getUserDeposit",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "user", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ];

  const userDepositRes = useReadContract({
    address: CENTRAL_WALLET_ADDRESS,
    abi: centralWalletAbi,
    functionName: "getUserDeposit",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address && !isWrongChain) },
  });
  const walletBalanceRes = useBalance({
    address,
    token: PYUSD_TOKEN_ADDRESS,
    chainId: SEPOLIA_CHAIN_ID,
    watch: true,
    query: { enabled: Boolean(address && !isWrongChain) },
  });

  const userDeposit = (() => {
    try {
      return userDepositRes.data ? Number(formatUnits(userDepositRes.data, PYUSD_DECIMALS)) : 0;
    } catch {
      return 0;
    }
  })();
  const walletBalance = (() => {
    try {
      return walletBalanceRes.data ? Number(formatUnits(walletBalanceRes.data.value, PYUSD_DECIMALS)) : 0;
    } catch {
      return 0;
    }
  })();

  const recipientDisplayName = useMemo(() => {
    if (recipientForm.type === "individual") {
      return [recipientForm.firstName, recipientForm.lastName].filter(Boolean).join(" ");
    }
    return recipientForm.businessName;
  }, [recipientForm.businessName, recipientForm.firstName, recipientForm.lastName, recipientForm.type]);

  const updateRecipientForm = useCallback((field, value) => {
    setRecipientForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  const resetRecipientFeedback = useCallback(() => {
    clearFeedbackTimeout();
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setRecipientFeedback("");
      feedbackTimeoutRef.current = null;
    }, 2500);
  }, [clearFeedbackTimeout]);

  useEffect(() => {
    return () => {
      clearFeedbackTimeout();
    };
  }, [clearFeedbackTimeout]);

  useEffect(() => {
    if (!selectedRecipient) {
      return;
    }

    const match = recipients.find((item) => String(item.id) === String(selectedRecipient.id));
    if (match && match !== selectedRecipient) {
      setSelectedRecipient(match);
    }
  }, [recipients, selectedRecipient]);

  useEffect(() => {
    if (!isConnected) {
      setSelectedRecipient(null);
    }
  }, [isConnected]);

  const validateRecipientStep = useCallback(() => {
    if (recipientStep === 1) {
      if (recipientForm.type === "individual") {
        if (!recipientForm.firstName && !recipientForm.lastName) {
          setRecipientFeedback("Add at least a first or last name.");
          resetRecipientFeedback();
          return false;
        }
      } else if (!recipientForm.businessName) {
        setRecipientFeedback("Business name is required.");
        resetRecipientFeedback();
        return false;
      }
    }

    if (recipientStep === TOTAL_RECIPIENT_STEPS) {
      const required = [
        { field: "accountNumber", label: "account number" },
        { field: "ifsc", label: "IFSC code" },
        { field: "bankName", label: "bank name" },
        { field: "accountHolder", label: "account holder" },
      ];

      for (const { field, label } of required) {
        if (!recipientForm[field]) {
          setRecipientFeedback(`Please add ${label}.`);
          resetRecipientFeedback();
          return false;
        }
      }

      if (!recipientForm.accountType) {
        setRecipientFeedback("Select an account type.");
        resetRecipientFeedback();
        return false;
      }
    }

    return true;
  }, [recipientForm, recipientStep, resetRecipientFeedback]);

  const handleRecipientNext = useCallback(() => {
    if (!validateRecipientStep()) return;
    setRecipientStep((prev) => Math.min(prev + 1, TOTAL_RECIPIENT_STEPS));
  }, [validateRecipientStep]);

  const handleRecipientBack = useCallback(() => {
    if (recipientStep === 1) {
      setStage("recipient");
    }
    setRecipientStep((prev) => Math.max(prev - 1, 1));
  }, [recipientStep, setRecipientStep, setStage]);

  const formatRecipientLabel = useCallback((recipient) => {
    if (!recipient) return "";
    const type = String(recipient.type || "INDIVIDUAL").toUpperCase();
    if (type === "BUSINESS") {
      return recipient.businessName || "Business";
    }
    const fullName = [recipient.firstName, recipient.lastName].filter(Boolean).join(" ");
    return fullName || recipient.businessName || "Individual";
  }, []);

  const handleRecipientSubmit = useCallback(async () => {
    if (!validateRecipientStep()) return;

    if (!isConnected || !address) {
      setRecipientFeedback("Connect your wallet first.");
      resetRecipientFeedback();
      return;
    }

    const payload = {
      ...recipientForm,
      walletAddress: address,
      accountType: recipientForm.accountType || "Other",
    };

    try {
      setRecipientSubmitting(true);
      const response = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to save recipient");
      }
      const rawRecipient = responseData.recipient ?? responseData ?? {};
      const gpsRecipient = responseData.gpsRecipient ?? null;
      const normalizedRecipient = {
        ...rawRecipient,
        ...payload,
        id: rawRecipient.id ?? rawRecipient.recipientId ?? payload.id ?? `temp-${Date.now()}`,
        type:
          rawRecipient.type ??
          (payload.type === "individual"
            ? "INDIVIDUAL"
            : payload.type === "business"
              ? "BUSINESS"
              : payload.type ?? "INDIVIDUAL"),
      };
      if (gpsRecipient) {
        normalizedRecipient.gpsRecipient = gpsRecipient;
        if (gpsRecipient.id && !normalizedRecipient.gpsRecipientId) {
          normalizedRecipient.gpsRecipientId = gpsRecipient.id;
        }
      }

      setRecipientFeedback("Recipient saved");
      setRecipientForm(emptyRecipientForm);
      setRecipientStep(1);
      setRecipients((previous) => {
        const filtered = previous.filter((item) => item.id !== normalizedRecipient.id);
        return [normalizedRecipient, ...filtered];
      });
      setSelectedRecipient(normalizedRecipient);
      setPaymentPurpose("");
      setPaymentDescription("");
      setStage("payment");
      resetRecipientFeedback();
    } catch (error) {
      console.error(error);
      setRecipientFeedback(error instanceof Error ? error.message : "Failed to save recipient");
      resetRecipientFeedback();
    } finally {
      setRecipientSubmitting(false);
    }
  }, [
    address,
    isConnected,
    recipientForm,
    resetRecipientFeedback,
    setPaymentDescription,
    setPaymentPurpose,
    setRecipients,
    setSelectedRecipient,
    setStage,
    validateRecipientStep,
  ]);

  const handleRecipientSelection = useCallback(
    (recipientId) => {
      if (!recipientId) {
        setSelectedRecipient(null);
        return;
      }

      setSelectedRecipient((previous) => {
        if (previous && String(previous.id) === String(recipientId)) {
          return previous;
        }
        const match = recipients.find((item) => String(item.id) === String(recipientId));
        return match ?? previous ?? null;
      });
    },
    [recipients, setSelectedRecipient],
  );

  const openRecipientForm = useCallback(() => {
    clearFeedbackTimeout();
    setRecipientFeedback("");
    setRecipientForm(emptyRecipientForm);
    setRecipientStep(1);
    setStage("recipientForm");
  }, [clearFeedbackTimeout, setRecipientFeedback, setRecipientForm, setRecipientStep, setStage]);

  const handleProceedToPayment = useCallback(() => {
    if (!selectedRecipient) {
      return;
    }
    setPaymentError("");
    setPaymentPurpose("");
    setPaymentDescription("");
    setStage("payment");
  }, [selectedRecipient, setPaymentDescription, setPaymentError, setPaymentPurpose, setStage]);

  const handlePaymentBack = useCallback(() => {
    setStage("recipient");
  }, [setStage]);

  const handlePaymentContinue = useCallback(() => {
    if (!paymentPurpose.trim() || !paymentDescription.trim()) {
      setPaymentError("Add purpose and description to continue.");
      return;
    }
    setPaymentError("");
    setStage("confirm");
  }, [paymentDescription, paymentPurpose, setPaymentError, setStage]);

  const handleConfirmBack = useCallback(() => {
    setStage("payment");
  }, [setStage]);

  const [transactionSubmitting, setTransactionSubmitting] = useState(false);
  const [transactionFeedback, setTransactionFeedback] = useState("");
  const [transactionFeedbackType, setTransactionFeedbackType] = useState("");

  useEffect(() => {
    if (stage !== "quote" && transactionFeedbackType === "success") {
      setTransactionFeedback("");
      setTransactionFeedbackType("");
    }
  }, [stage, transactionFeedbackType]);

  const resetFlow = useCallback(() => {
    setStage("quote");
    setSelectedRecipient(null);
    setPaymentPurpose("");
    setPaymentDescription("");
    setPaymentError("");
  }, []);

  const renderRecipientStepContent = useCallback(() => {
    switch (recipientStep) {
      case 1:
        return (
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Payee type</Label>
            <div className="flex items-center gap-2">
              {["individual", "business"].map((option) => (
                <Button
                  key={option}
                  variant={recipientForm.type === option ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => updateRecipientForm("type", option)}
                >
                  {option === "individual" ? "Individual" : "Business"}
                </Button>
              ))}
            </div>

            {recipientForm.type === "individual" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-xs font-semibold uppercase text-muted-foreground">
                    First name
                  </Label>
                  <Input
                    id="first-name"
                    value={recipientForm.firstName}
                    onChange={(event) => updateRecipientForm("firstName", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-xs font-semibold uppercase text-muted-foreground">
                    Last name
                  </Label>
                  <Input
                    id="last-name"
                    value={recipientForm.lastName}
                    onChange={(event) => updateRecipientForm("lastName", event.target.value)}
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
                  value={recipientForm.businessName}
                  onChange={(event) => updateRecipientForm("businessName", event.target.value)}
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
                value={recipientForm.email}
                onChange={(event) => updateRecipientForm("email", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase text-muted-foreground">
                Phone
              </Label>
              <Input
                id="phone"
                value={recipientForm.phone}
                onChange={(event) => updateRecipientForm("phone", event.target.value)}
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
                value={recipientForm.accountNumber}
                onChange={(event) => updateRecipientForm("accountNumber", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ifsc" className="text-xs font-semibold uppercase text-muted-foreground">
                IFSC code
              </Label>
              <Input
                id="ifsc"
                value={recipientForm.ifsc}
                onChange={(event) => updateRecipientForm("ifsc", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-name" className="text-xs font-semibold uppercase text-muted-foreground">
                Bank name
              </Label>
              <Input
                id="bank-name"
                value={recipientForm.bankName}
                onChange={(event) => updateRecipientForm("bankName", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-holder" className="text-xs font-semibold uppercase text-muted-foreground">
                Account holder name
              </Label>
              <Input
                id="account-holder"
                value={recipientForm.accountHolder}
                onChange={(event) => updateRecipientForm("accountHolder", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch" className="text-xs font-semibold uppercase text-muted-foreground">
                Branch
              </Label>
              <Input
                id="branch"
                value={recipientForm.branch}
                onChange={(event) => updateRecipientForm("branch", event.target.value)}
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
                    variant={recipientForm.accountType === accountType ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => updateRecipientForm("accountType", accountType)}
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
  }, [recipientForm, recipientStep, updateRecipientForm]);

  const [sendAmount, setSendAmount] = useState(DEFAULT_SEND_AMOUNT);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [amountSource, setAmountSource] = useState("from");
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL_MS / 1000);

  const amountValue = amountSource === "from" ? sendAmount : receiveAmount;
  const parsedAmount = Number.parseFloat(amountValue || "0");
  const canFetchQuote = !isWrongChain && Number.isFinite(parsedAmount) && parsedAmount > 0;

  const quoteQuery = useQuery({
    queryKey: ["gps-quote", amountSource, amountValue],
    queryFn: async () => {
      const trimmedAmount = amountValue?.trim();
      if (!trimmedAmount) {
        throw new Error("Amount is required");
      }

      const payload = {
        fromCurrency: "USD",
        toCurrency: "INR",
        ...(amountSource === "from" ? { fromAmount: trimmedAmount } : { toAmount: trimmedAmount }),
      };

      const response = await fetch("/api/gps/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to fetch quote");
      }

      if (!data?.success || !data?.data) {
        throw new Error("Invalid quote response");
      }

      return data.data;
    },
    enabled: canFetchQuote,
    refetchInterval: canFetchQuote ? REFRESH_INTERVAL_MS : false,
  });

  const quoteData = quoteQuery.data;
  const quoteErrorMessage = quoteQuery.error instanceof Error ? quoteQuery.error.message : quoteQuery.error ? "Unable to fetch quote" : "";

  const sendAmountNumber = Number.parseFloat(sendAmount || "0");
  const receiveAmountNumber = Number.parseFloat(receiveAmount || "0");
  const formattedSendAmount = Number.isFinite(sendAmountNumber) ? sendAmountNumber.toFixed(2) : "0.00";
  const formattedReceiveAmount = Number.isFinite(receiveAmountNumber) ? receiveAmountNumber.toFixed(2) : "";

  const rateValue = quoteData?.rate ? Number.parseFloat(String(quoteData.rate)) : null;
  const midMarketRateValue = quoteData?.midMarketRate ? Number.parseFloat(String(quoteData.midMarketRate)) : null;
  const rateLabel = rateValue ? `1 USD = ₹${rateValue.toFixed(4)}` : "Rate unavailable";
  const midMarketLabel = midMarketRateValue ? `₹${midMarketRateValue.toFixed(4)}` : "—";
  const rateDifferenceValue = rateValue && midMarketRateValue ? ((rateValue - midMarketRateValue) / midMarketRateValue) * 100 : null;
  const rateDifferenceLabel = typeof rateDifferenceValue === "number" ? `${rateDifferenceValue >= 0 ? "+" : ""}${rateDifferenceValue.toFixed(2)}%` : "—";
  const countdownLabel = quoteQuery.isFetching
    ? "Refreshing..."
    : refreshCountdown > 0
      ? `Refresh in ${refreshCountdown}s`
      : canFetchQuote
        ? "Refresh soon"
        : "";

  const handleMax = useCallback(() => {
    if (!isConnected || isWrongChain) return;
    const value = walletBalance.toFixed(2);
    setTransactionFeedback("");
    setTransactionFeedbackType("");
    setAmountSource("from");
    setSendAmount(value);
  }, [isConnected, isWrongChain, walletBalance]);

  const handleExecuteTransaction = useCallback(async () => {
    if (!selectedRecipient) {
      setPaymentError("Select a recipient before continuing.");
      return;
    }

    const amountNumeric = Number.parseFloat(String(sendAmount || "0"));
    if (!Number.isFinite(amountNumeric) || amountNumeric <= 0) {
      setPaymentError("Enter a valid send amount.");
      return;
    }

    setPaymentError("");
    setTransactionFeedback("");
    setTransactionFeedbackType("");
    setTransactionSubmitting(true);

    const payload = {
      recipientId: String(selectedRecipient.id),
      fromAmount: amountNumeric.toString(),
      notes: paymentDescription.trim(),
      purposeOfPayment: paymentPurpose.trim(),
    };

    try {
      const response = await fetch("/api/gps/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to execute transaction");
      }

      setTransactionFeedback("Transaction submitted successfully.");
      setTransactionFeedbackType("success");
      resetFlow();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to execute transaction";
      setTransactionFeedback(message);
      setTransactionFeedbackType("error");
    } finally {
      setTransactionSubmitting(false);
    }
  }, [
    paymentDescription,
    paymentPurpose,
    resetFlow,
    selectedRecipient,
    sendAmount,
    setPaymentError,
  ]);

  useEffect(() => {
    if (!quoteData) return;

    if (amountSource === "from" && quoteData.toAmount) {
      setReceiveAmount(String(quoteData.toAmount));
    }

    if (amountSource === "to" && quoteData.fromAmount) {
      setSendAmount(String(quoteData.fromAmount));
    }
  }, [amountSource, quoteData]);

  useEffect(() => {
    if (!canFetchQuote) {
      setRefreshCountdown(0);
      return;
    }

    setRefreshCountdown(REFRESH_INTERVAL_MS / 1000);
  }, [canFetchQuote, quoteQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!canFetchQuote || quoteQuery.isFetching) {
      return;
    }

    const timer = window.setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [canFetchQuote, quoteQuery.isFetching]);

  useEffect(() => {
    if (!isConnected) {
      switchAttemptedRef.current = false;
      return;
    }

    if (isWrongChain && !switchAttemptedRef.current) {
      switchAttemptedRef.current = true;
      switchChainAsync?.({ chainId: SEPOLIA_CHAIN_ID }).catch((error) => {
        console.error("Automatic chain switch failed", error);
        switchAttemptedRef.current = false;
      });
    } else if (!isWrongChain) {
      switchAttemptedRef.current = false;
    }
  }, [isConnected, isWrongChain, switchChainAsync]);

  useEffect(() => {
    if (stage !== "recipient") {
      return;
    }

    if (!isConnected || !address) {
      setRecipients([]);
      setRecipientStatus("idle");
      setRecipientError("");
      return;
    }

    const controller = new AbortController();

    const loadRecipients = async () => {
      setRecipientStatus("loading");
      setRecipientError("");

      try {
        const response = await fetch(`/api/recipients?walletAddress=${address}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch recipients");
        }

        const data = await response.json();
        setRecipients(data.recipients ?? []);
        setRecipientStatus("success");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error(error);
        setRecipientError("Unable to load recipients");
        setRecipientStatus("error");
      }
    };

    loadRecipients();

    return () => {
      controller.abort();
    };
  }, [stage, isConnected, address]);

  const handleContinue = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    if (isWrongChain) {
      try {
        await switchChainAsync?.({ chainId: SEPOLIA_CHAIN_ID });
      } catch (error) {
        console.error("Failed to switch network", error);
      }
      return;
    }

    setStage("recipient");
  }, [isConnected, isWrongChain, setStage, switchChainAsync]);

  if (stage === "recipient") {
    const hasRecipients = recipients.length > 0;

    return (
      <section className="flex w-full justify-end lg:flex-1">
        <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
          <CardContent className="space-y-6 px-6 pb-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Recipient</p>
              <h1 className="text-lg font-semibold">Choose a payee</h1>
            </div>

            <Separator className="bg-border" />

            {!isConnected ? (
              <p className="text-sm text-muted-foreground">
                Connect your wallet to view recipients linked to this address.
              </p>
            ) : recipientStatus === "loading" ? (
              <p className="text-sm text-muted-foreground">Loading recipients...</p>
            ) : recipientStatus === "error" ? (
              <p className="text-sm text-destructive">{recipientError}</p>
            ) : hasRecipients ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient-select" className="text-xs font-semibold uppercase text-muted-foreground">
                    Saved recipients
                  </Label>
                  <select
                    id="recipient-select"
                    value={selectedRecipient ? String(selectedRecipient.id) : ""}
                    onChange={(event) => handleRecipientSelection(event.target.value)}
                    className="w-full rounded-[var(--radius-lg)] border bg-background px-4 py-2 text-sm text-card-foreground"
                  >
                    <option value="" disabled>
                      Select a recipient
                    </option>
                    {recipients.map((recipient) => (
                      <option key={recipient.id} value={String(recipient.id)}>
                        {formatRecipientLabel(recipient)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRecipient ? (
                  <div className="space-y-2 rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-card-foreground">
                        {formatRecipientLabel(selectedRecipient)}
                      </span>
                      <span className="text-[11px] uppercase text-primary">{selectedRecipient.accountType}</span>
                    </div>
                    <div className="grid gap-1 text-[11px]">
                      <span>{selectedRecipient.bankName}</span>
                      <span>Account: {selectedRecipient.accountNumber}</span>
                      <span>IFSC: {selectedRecipient.ifsc}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!hasRecipients && isConnected && recipientStatus === "success" ? (
              <p className="text-sm text-muted-foreground">
                No recipients saved yet. Add one to reuse bank details quickly.
              </p>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[11px] uppercase text-muted-foreground">
                <Separator className="flex-1 bg-border" />
                <span>or</span>
                <Separator className="flex-1 bg-border" />
              </div>
              <Button type="button" size="lg" className="w-full rounded-full" onClick={openRecipientForm} disabled={!isConnected}>
                Add new recipient
              </Button>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-6 pb-6">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setStage("quote")}>
                Back to quote
              </Button>
              <Button
                size="lg"
                className="flex-1 rounded-full"
                onClick={handleProceedToPayment}
                disabled={!isConnected || !selectedRecipient}
              >
                Continue
              </Button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Recipients are stored by wallet address. Switch wallets to view others.
            </p>
          </CardFooter>
        </Card>
      </section>
    );
  }

  if (stage === "recipientForm") {
    return (
      <section className="flex w-full justify-end lg:flex-1">
        <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
          <CardContent className="space-y-6 px-6 pb-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full border px-3"
                onClick={() => setStage("recipient")}
              >
                Recipients
              </Button>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Recipient</p>
                <h1 className="text-lg font-semibold">
                  {recipientStep === 1 ? "Payee profile" : recipientStep === 2 ? "Contact details" : "Bank details"}
                </h1>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">{renderRecipientStepContent()}</div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-6 pb-6">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={handleRecipientBack}
                disabled={recipientStep === 1 || recipientSubmitting}
              >
                Back
              </Button>
              {recipientStep < TOTAL_RECIPIENT_STEPS ? (
                <Button size="lg" className="flex-1 rounded-full" onClick={handleRecipientNext}>
                  Next
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1 rounded-full"
                  onClick={handleRecipientSubmit}
                  disabled={recipientSubmitting}
                >
                  {recipientSubmitting ? "Saving..." : "Save recipient"}
                </Button>
              )}
            </div>

            {recipientFeedback ? (
              <p className="text-center text-[11px] text-muted-foreground">{recipientFeedback}</p>
            ) : null}
            <p className="text-center text-[11px] text-muted-foreground">
              Recipient name: {recipientDisplayName || "—"}
            </p>
          </CardFooter>
        </Card>
      </section>
    );
  }

  if (stage === "payment") {
    return (
      <section className="flex w-full justify-end lg:flex-1">
        <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
          <CardContent className="space-y-6 px-6 pb-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Payment details</p>
              <h1 className="text-lg font-semibold">Enter transfer purpose</h1>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              {selectedRecipient ? (
                <div className="space-y-2 rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-card-foreground">
                      {formatRecipientLabel(selectedRecipient)}
                    </span>
                    <span className="text-[11px] uppercase text-primary">{selectedRecipient.accountType}</span>
                  </div>
                  <div className="grid gap-1 text-[11px]">
                    <span>{selectedRecipient.bankName}</span>
                    <span>Account: {selectedRecipient.accountNumber}</span>
                    <span>IFSC: {selectedRecipient.ifsc}</span>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="payment-purpose" className="text-xs font-semibold uppercase text-muted-foreground">
                  Purpose of payment
                </Label>
                <Input
                  id="payment-purpose"
                  value={paymentPurpose}
                  onChange={(event) => setPaymentPurpose(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-description" className="text-xs font-semibold uppercase text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="payment-description"
                  value={paymentDescription}
                  onChange={(event) => setPaymentDescription(event.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-6 pb-6">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={handlePaymentBack}>
                Back
              </Button>
              <Button size="lg" className="flex-1 rounded-full" onClick={handlePaymentContinue}>
                Continue
              </Button>
            </div>
            {paymentError ? (
              <p className="text-center text-[11px] text-destructive">{paymentError}</p>
            ) : null}
          </CardFooter>
        </Card>
      </section>
    );
  }

  if (stage === "confirm") {
    return (
      <section className="flex w-full justify-end lg:flex-1">
        <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
          <CardContent className="space-y-6 px-6 pb-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Review</p>
              <h1 className="text-lg font-semibold">Confirm transfer details</h1>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-card-foreground">Transfer</h2>
                <div className="rounded-[var(--radius-lg)] border bg-muted px-4 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span>You send</span>
                    <span className="font-semibold text-card-foreground">${formattedSendAmount} PYUSD</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>They receive</span>
                    <span className="font-semibold text-card-foreground">
                      {formattedReceiveAmount ? `${formattedReceiveAmount} INR` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Mid-market rate</span>
                    <span className="font-semibold text-card-foreground">{midMarketLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Rate</span>
                    <span className="font-semibold text-card-foreground">{rateLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Rate difference</span>
                    <span className="font-semibold text-card-foreground">{rateDifferenceLabel}</span>
                  </div>
                </div>
              </div>

              {selectedRecipient ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-card-foreground">Recipient</h2>
                  <div className="rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-card-foreground">
                        {formatRecipientLabel(selectedRecipient)}
                      </span>
                      <span className="text-[11px] uppercase text-primary">{selectedRecipient.accountType}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px]">
                      <span>{selectedRecipient.bankName}</span>
                      <span>Account: {selectedRecipient.accountNumber}</span>
                      <span>IFSC: {selectedRecipient.ifsc}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-card-foreground">Payment details</h2>
                <div className="rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Purpose</span>
                    <span className="font-semibold text-card-foreground">{paymentPurpose}</span>
                  </div>
                  <Separator className="my-3 bg-border" />
                  <p className="leading-relaxed text-muted-foreground">{paymentDescription}</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-6 pb-6">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={handleConfirmBack}>
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1 rounded-full"
                onClick={handleExecuteTransaction}
                disabled={transactionSubmitting}
              >
                {transactionSubmitting ? "Submitting..." : "Confirm & execute"}
              </Button>
            </div>
            {transactionFeedback && transactionFeedbackType === "error" ? (
              <p className="text-center text-[11px] text-destructive">{transactionFeedback}</p>
            ) : null}
          </CardFooter>
        </Card>
      </section>
    );
  }

  if (stage === "quote") {

    return (
      <section className="flex w-full justify-end lg:flex-1">
        <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
          <CardContent className="space-y-6 px-6 pb-2">

            {transactionFeedback && transactionFeedbackType === "success" ? (
              <div className="rounded-full bg-primary/10 px-4 py-2 text-center text-xs font-semibold text-primary">
                {transactionFeedback}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="send-amount" className="text-xs font-semibold uppercase text-muted-foreground">
                You send
              </Label>
              <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-muted px-4 py-3">
                <Input
                  id="send-amount"
                  type="number"
                  value={sendAmount}
                  min="0"
                  onChange={(event) => {
                    const value = event.target.value;
                    const numericValue = Number.parseFloat(value);
                    if (transactionFeedback) {
                      setTransactionFeedback("");
                      setTransactionFeedbackType("");
                    }
                    setAmountSource("from");
                    setSendAmount(value);
                    if (!value || !Number.isFinite(numericValue) || numericValue <= 0) {
                      setReceiveAmount("");
                    }
                  }}
                  className="border-0 bg-transparent px-0 text-xl font-semibold text-card-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-3 text-xs"
                  onClick={handleMax}
                  disabled={!isConnected || isWrongChain || walletBalance === 0}
                >
                  Max
                </Button>
                <div className="flex flex-col items-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-secondary/50 px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                  <span>PYUSD</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                {isConnected ? (
                  isWrongChain ? (
                    <p>Switch to Sepolia to view balances.</p>
                  ) : (
                    <>
                      <p>
                        Available balance: <span className="font-semibold text-card-foreground">${walletBalance.toFixed(2)}</span>
                      </p>
                    </>
                  )
                ) : (
                  <p>Connect your wallet to view balances.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receive-amount" className="text-xs font-semibold uppercase text-muted-foreground">
                They receive
              </Label>
              <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border bg-background px-4 py-3">
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-lg font-semibold text-muted-foreground">₹</span>
                  <Input
                    id="receive-amount"
                    type="number"
                    min="0"
                    value={receiveAmount}
                    onChange={(event) => {
                      const value = event.target.value;
                      const numericValue = Number.parseFloat(value);
                      if (transactionFeedback) {
                        setTransactionFeedback("");
                        setTransactionFeedbackType("");
                      }
                      setAmountSource("to");
                      setReceiveAmount(value);
                      if (!value || !Number.isFinite(numericValue) || numericValue <= 0) {
                        setSendAmount("");
                      }
                    }}
                    className="border-0 bg-transparent px-0 text-xl font-semibold text-card-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </div>
                <div className="ml-auto flex flex-col items-end gap-1 rounded-[var(--radius-lg)] bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  <span>INR</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-medium text-card-foreground">{rateLabel}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {canFetchQuote ? countdownLabel : "Enter an amount"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Mid-market rate</span>
                <span className="font-semibold text-card-foreground">{midMarketLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Our rate vs mid-market</span>
                <span className="font-semibold text-card-foreground">{rateDifferenceLabel}</span>
              </div>
              <ul className="space-y-1 pt-1 text-[10px]">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  Compliance checks run in real time
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary-foreground/40" />
                  Rate holds for 30 minutes
                </li>
              </ul>
              {quoteErrorMessage ? (
                <p className="rounded-full bg-destructive/10 px-3 py-1 text-center text-[11px] font-semibold text-destructive">
                  {quoteErrorMessage}
                </p>
              ) : null}
              {isWrongChain ? (
                <p className="rounded-full bg-destructive/10 px-3 py-1 text-center text-[11px] font-semibold text-destructive">
                  Switch to Sepolia to continue
                </p>
              ) : null}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 px-6 pb-6">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal: open, mounted }) => {
                const connected = mounted && account;
                const chainLabel = chain?.id === SEPOLIA_CHAIN_ID ? "Sepolia" : "Wrong network";

                return (
                  <div className="flex flex-col gap-3">
                    <Button
                      size="lg"
                      className="w-full rounded-full"
                      onClick={() => {
                        if (!account) {
                          open?.();
                          return;
                        }
                        void handleContinue();
                      }}
                    >
                      {!account
                        ? "Connect wallet to continue"
                        : isWrongChain
                          ? "Switching to Sepolia..."
                          : "Continue to recipient"}
                    </Button>

                    {connected ? (
                      <div className="flex items-center justify-between rounded-[var(--radius-lg)] border bg-muted px-4 py-2 text-xs text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold text-card-foreground">{account.displayName}</span>
                          <span>{chainLabel}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => disconnect()}
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="sr-only">Disconnect wallet</span>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              }}
            </ConnectButton.Custom>
            <p className="text-center text-[11px] text-muted-foreground">
              Regulated transfers by PY Remit Labs LLC.
            </p>
          </CardFooter>
        </Card>
      </section>
    );
  }
}
