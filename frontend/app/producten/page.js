import { tx } from "../../lib/t";
import Link from "next/link";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import { mediaUrl } from "../../lib/api";
import { money } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";
import { requireModule, shopGet } from "../../lib/shop-server";

export const dynamic = "force-dynamic";
export const generateMetadata = async () => ({ title: tx("Producten"), ...(await pageMetadata("/producten")) });

export default async function Products({ searchParams }) {
  await requireModule("products");
  const { groep } = await searchParams;
  const [groups, products] = await Promise.all([shopGet("/shop/groups/"), shopGet(`/shop/products/${groep ? `?group=${encodeURIComponent(groep)}` : ""}`)]);
  const roots = (groups || []).filter((g) => !g.parent);
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Producten")}</h1>
        {roots.length > 0 && (
          <div className="shop-chips">
            <Link href="/producten" className={!groep ? "active" : ""}>{tx("Alles")}</Link>
            {(groups || []).map((g) => <Link key={g.id} href={`/producten?groep=${g.slug}`} className={groep === g.slug ? "active" : ""}>{g.name} ({g.count})</Link>)}
          </div>
        )}
        <div className="product-grid">
          {(products || []).map((p) => (
            <Link key={p.id} href={`/producten/${p.slug}`} className="card product-card">
              <div className="pimg">{p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(p.image.url)} alt={p.image.alt} /> : tx("Geen foto")}</div>
              <div className="pbody">
                <strong>{p.name}</strong>
                {p.summary && <span className="muted" style={{ fontSize: ".875rem" }}>{p.summary}</span>}
                <span className="price">{money(p.price)}</span>
                {p.stock === "out" && <span className="stock-out">{tx("Uitverkocht")}</span>}
                {p.stock === "low" && <span className="stock-low">{tx("Bijna uitverkocht")}</span>}
              </div>
            </Link>
          ))}
          {products && !products.length && <p className="muted">{tx("Er zijn nog geen producten.")}</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
