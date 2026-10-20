import NotFoundView from "../../components/NotFoundView";

export const metadata = { title: "404", robots: "noindex, nofollow" };

// Same page as the automatic 404, reachable on purpose at /404 so it can be opened and edited from Admin -> Pagina's
export default function NotFoundPreview() {
  return <NotFoundView />;
}
