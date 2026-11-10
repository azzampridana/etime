"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-3 py-6"><p>Unable to load payslip. Please try again.</p><Button onClick={reset} variant="outline">Try again</Button></div>; }
