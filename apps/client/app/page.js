import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const steps = [
	{
		title: "1. Get a quote",
		href: "/app",
		description: "Lock FX and fees upfront with automatic risk screening.",
	},
	{
		title: "2. Verify & fund",
		href: "/app/funds",
		description: "Review compliance checks and top up your settlement balance.",
	},
	{
		title: "3. Trigger payout",
		href: "/app",
		description: "Submit the remittance for instant delivery to the recipient bank.",
	},
];

export default function HomeLanding() {
	redirect("/app");
	return null;
}
