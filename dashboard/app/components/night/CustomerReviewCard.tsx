"use client";

import { useContext, useState } from "react";
import { post } from "../../lib/api";
import { DemoContext } from "../../lib/data";
import type { Review, ReviewCustomer } from "../../lib/types";
import { useToast } from "../ui";
import { Btn } from "./primitives";

export function CustomerReviewCard({ customer, review }: { customer: ReviewCustomer; review: Review }) {
  const demo = useContext(DemoContext);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const running = review.status === "running";
  async function decide(decision: "approve" | "reject") {
    if (demo) return toast("Sample data is on, so nothing was sent.", true);
    if (!review._id || busy) return;
    setBusy(true);
    const error = await post(`/review/${encodeURIComponent(review._id)}/${encodeURIComponent(customer.member_id)}/${decision}`);
    setBusy(false);
    toast(error ?? `${decision === "approve" ? "Approved" : "Rejected"} changes for ${customer.member_name}.`, Boolean(error));
  }
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[17px] font-semibold">{customer.member_name}</h3>
        <span className={`text-[12px] ${customer.status === "approved" ? "text-green" : customer.status === "proposed" ? "text-amber" : "text-muted"}`}>
          {customer.status === "no_change" ? "No change needed" : customer.status ? customer.status.charAt(0).toUpperCase() + customer.status.slice(1) : "New review needed"}
        </span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        {customer.summary || (running ? "Review in progress…" : "No customer summary available. Run a new review.")}
      </p>
      {customer.status === "proposed" && review._id && (
        <div className="mt-4 flex gap-2">
          <Btn variant="ink" size="sm" disabled={busy || running || !customer.summary.trim()} onClick={() => decide("approve")}>Approve</Btn>
          <Btn variant="quiet" size="sm" disabled={busy || running} onClick={() => decide("reject")}>Reject</Btn>
        </div>
      )}
    </div>
  );
}
