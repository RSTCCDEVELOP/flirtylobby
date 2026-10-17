import { tx } from "../../../lib/t";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "../../../components/Cart";
import SiteFooter from "../../../components/SiteFooter";
import SiteHeader from "../../../components/SiteHeader";
import { mediaUrl } from "../../../lib/api";
import { money } from "../../../lib/format";
import { absoluteUrl } from "../../../lib/seo";
import { requireModule, shopGet } from "../../../lib/shop-server";
import ProductGallery from "./Gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await shopGet(`/shop/products/${slug}/`);
  if (!p) return {};
  return { title: p.name, description: p.summary || undefined, openGraph: { title: p.name, description: p.summary || undefined, images: p.image ? [absoluteUrl(p.image.url)] : undefined } };
}

export default async function Product({ params }) {
  await requireModule("products");
  const { slug } = await params;
  const [p, cfg] = await Promise.all([shopGet(`/shop/products/${slug}/`), shopGet("/shop/config/")]);
  if (!p) notFound();
  const jsonld = { "@context": "https://schema.org", "@type": tx("Product"), name: p.name, description: p.summary || undefined, sku: p.sku || undefined,
    image: p.images.map((i) => absoluteUrl(i.url)), offers: { "@type": tx("Offer"), price: p.price, priceCurrency: "EUR", availability: p.stock === "out" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } };
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <p className="muted" style={{ marginTop: 0 }}><Link href="/producten">{tx("Producten")}</Link>{p.group && <> / <Link href={`/producten?groep=${p.group.slug}`}>{p.group.name}</Link></>}</p>
        <div className="product-detail">
          <ProductGallery images={p.images.map((i) => ({ url: mediaUrl(i.url), alt: i.alt }))} />
          <div>
            <h1>{p.name}</h1>
            <p className="price" style={{ fontSize: "1.5rem" }}>{money(p.price)}{cfg && <small className="muted" style={{ fontSize: ".8rem", fontWeight: 500 }}> {cfg.prices_include_vat ? "incl." : "excl."} {tx("btw")}</small>}</p>
            {p.stock === "out" && <p className="stock-out">{tx("Uitverkocht")}</p>}
            {p.stock === "low" && <p className="stock-low">{tx("Nog maar enkele op voorraad")}</p>}
            {p.summary && <p className="muted">{p.summary}</p>}
            <AddToCart id={p.id} disabled={p.stock === "out"} />
            {p.description && <div className="rich-text" style={{ marginTop: "1.5rem" }} dangerouslySetInnerHTML={{ __html: p.description }} />}
            {p.sku && <p className="muted" style={{ fontSize: ".8rem" }}>{tx("Artikelnummer:")} {p.sku}</p>}
          </div>
        </div>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }} />
    </div>
  );
}
