// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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
