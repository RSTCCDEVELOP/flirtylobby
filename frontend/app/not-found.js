import NotFoundView from "../components/NotFoundView";

export const metadata = { title: "404", robots: "noindex, nofollow" };

export default function NotFound() {
  return <NotFoundView />;
}
