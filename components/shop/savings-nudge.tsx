import { BadgePercent, CircleCheck, Truck } from "lucide-react";
import { cx } from "@/components/ui";
import { kes } from "@/lib/format";
import type { Incentives } from "@/lib/incentives";

/**
 * One calm card for the shopping incentives (lib/incentives): how far to free delivery, the
 * product closest to its wholesale price, or what's already unlocked. Soft pink while
 * approaching, soft green once unlocked. Renders nothing when there's nothing to say.
 */
export function SavingsNudge({ value, className }: { value: Incentives; className?: string }) {
  const { wholesale, wholesaleUnlocked, delivery } = value;
  const deliveryUnlocked = delivery?.unlocked ?? false;
  const anyUnlocked = deliveryUnlocked || wholesaleUnlocked.length > 0;
  const approaching = (delivery && !delivery.unlocked) || wholesale;
  if (!approaching && !anyUnlocked) return null;

  const where = delivery?.where ? ` ${delivery.where}` : "";
  const unlockedText = [wholesaleUnlocked.length > 0 && "Wholesale pricing", deliveryUnlocked && `free${where} delivery`].filter(Boolean).join(" + ");

  return (
    <div className={cx("space-y-2.5 rounded-2xl px-4 py-3.5 text-[14px]", approaching ? "bg-[#FDF2F8] text-[#831843]" : "bg-[#E8F7EC] text-[#166534]", className)} aria-live="polite">
      {delivery && !delivery.unlocked && (
        <div>
          <p className="flex items-start gap-2.5"><Truck className="mt-0.5 size-5 shrink-0 text-[#E6007E]" />
            <span>Add <strong>{kes(delivery.remaining)}</strong> more for <strong>free{where} delivery</strong>.</span></p>
          <div className="ml-[30px] mt-2 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(delivery.progress * 100)} aria-label="Progress to free delivery">
            <div className="h-full rounded-full bg-[#E6007E] transition-[width] duration-300" style={{ width: `${delivery.progress * 100}%` }} />
          </div>
        </div>
      )}
      {wholesale && (
        <p className="flex items-start gap-2.5"><BadgePercent className="mt-0.5 size-5 shrink-0 text-[#E6007E]" />
          <span>Add <strong>{wholesale.more} more</strong> {wholesale.name} for the wholesale price of <strong>{kes(wholesale.unitPrice)}</strong> each{wholesale.saving > 0 ? <> (save {kes(wholesale.saving)})</> : null}.</span></p>
      )}
      {anyUnlocked && (
        <p className={cx("flex items-start gap-2.5 font-semibold", approaching && "text-[#166534]")}><CircleCheck className="mt-0.5 size-5 shrink-0 text-[#22A845]" />
          <span>{unlockedText.charAt(0).toUpperCase() + unlockedText.slice(1)} unlocked{wholesaleUnlocked.length > 0 && !deliveryUnlocked ? ` on ${wholesaleUnlocked.join(", ")}` : ""}.</span></p>
      )}
    </div>
  );
}
