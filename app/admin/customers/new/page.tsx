import { PageHeader } from "@/components/ui";
import { CustomerForm } from "./customer-form";

export const metadata = { title: "New Customer" };

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader title="New Customer" subtitle="Add a walk-in, phone or salon customer so their orders and loyalty are tracked." />
      <CustomerForm />
    </div>
  );
}
