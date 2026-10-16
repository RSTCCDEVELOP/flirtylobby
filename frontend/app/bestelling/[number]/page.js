import OrderStatus from "./OrderStatus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bestelling", robots: "noindex" };

export default async function OrderPage({ params, searchParams }) {
  const { number } = await params;
  const { t } = await searchParams;
  return <OrderStatus number={number} token={t || ""} />;
}
