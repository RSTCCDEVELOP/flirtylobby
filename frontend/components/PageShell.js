import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

// The frame of a public page: header, the page and footer, as the setup of the page says (header or footer off, its own theme limited to this page).
export default function PageShell({ setup, children }) {
  return (
    <div className={`site${setup?.theme ? " page-scope" : ""}`}>
      {setup?.fonts_url && <link rel="stylesheet" href={setup.fonts_url} />}
      {setup?.css && <style dangerouslySetInnerHTML={{ __html: setup.css }} />}
      {setup?.header !== false && <SiteHeader />}
      {children}
      {setup?.footer !== false && <SiteFooter />}
    </div>
  );
}
