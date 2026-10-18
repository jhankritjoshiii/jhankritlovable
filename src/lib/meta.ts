export const pageMeta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · DMart SalesSense` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · DMart SalesSense` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
