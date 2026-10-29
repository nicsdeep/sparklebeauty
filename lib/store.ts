// Real shop details from Nicholas (2026-10-30). Every screen reads them from here.

export const STORE = {
  name: "Sparkle Beauty & Cosmetics",
  address: "Kware, Pipeline, Nairobi",
  landmark: "Near Redeemed Gospel Church and King Worship Centre",
  hours: "Open daily, 7:00 am – 8:00 pm",
  // Google Maps embed supplied by Nicholas (search for the shop in Pipeline).
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m12!1m8!1m3!1d510575.2266188962!2d36.8737081!3d-1.24993!3m2!1i1024!2i768!4f13.1!2m1!1ssparkle%20beauty%20and%20cosmetics%20pipeline!5e0!3m2!1sen!2ske!4v1793311769338!5m2!1sen!2ske",
  directionsUrl: "https://www.google.com/maps/search/?api=1&query=Sparkle+Beauty+and+Cosmetics+Pipeline+Nairobi",
  phones: [
    { label: "Shop 1", number: "0799 912 191" },
    { label: "Shop 2", number: "0797 468 963" },
    { label: "Shop 2", number: "0719 707 857" },
  ],
} as const;

export const MAIN_PHONE = STORE.phones[0].number;

export const telHref = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
