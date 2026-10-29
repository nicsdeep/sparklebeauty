// Real shop details from Nicholas (2026-10-30). Every screen reads them from here.

export const STORE = {
  name: "Sparkle Beauty & Cosmetics",
  address: "Kware, Pipeline, Nairobi",
  landmark: "Near Redeemed Gospel Church and King Worship Centre",
  hours: "Open daily, 7:00 am – 8:00 pm",
  phones: [
    { label: "Shop 1", number: "0799 912 191" },
    { label: "Shop 2", number: "0797 468 963" },
    { label: "Shop 2", number: "0719 707 857" },
  ],
} as const;

export const MAIN_PHONE = STORE.phones[0].number;

export const telHref = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
