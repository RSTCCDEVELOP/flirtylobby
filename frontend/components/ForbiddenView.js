// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { EditableText } from "./EditMode";
import ForbiddenActions from "./ForbiddenActions";
import Movable from "./Movable";
import PageBlocks from "./PageBlocks";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import SystemPageMark from "./SystemPageMark";

const TITLE = { nl: "Content niet beschikbaar", en: "Content not available", de: "Inhalt nicht verfügbar", fr: "Contenu non disponible", es: "Contenido no disponible", pt: "Conteúdo não disponível", zh: "内容不可用", ar: "المحتوى غير متاح" };
const BODY = {
  nl: "Deze pagina is niet beschikbaar voor jou. Log in als je een account hebt, of ga terug naar de startpagina.",
  en: "This page is not available to you. Log in if you have an account, or go back to the home page.",
  de: "Diese Seite ist für dich nicht verfügbar. Melde dich an, wenn du ein Konto hast, oder gehe zurück zur Startseite.",
  fr: "Cette page n’est pas disponible pour vous. Connectez-vous si vous avez un compte, ou retournez à l’accueil.",
  es: "Esta página no está disponible para ti. Inicia sesión si tienes una cuenta, o vuelve al inicio.",
  pt: "Esta página não está disponível para si. Inicie sessão se tiver uma conta, ou volte à página inicial.",
  zh: "此页面对你不可用。如有账户请登录，或返回首页。",
  ar: "هذه الصفحة غير متاحة لك. سجّل الدخول إذا كان لديك حساب، أو عد إلى الصفحة الرئيسية.",
};

// The page for content that is not for this visitor (a protected address such as /dashboard, or a page for members only): like the 404. Title and text can be changed in edit mode,
// per language (Admin -> Pagina's -> Content niet beschikbaar, address /geen-toegang). The buttons: back to the home page and, for a visitor who is not logged in, Inloggen.
export default function ForbiddenView() {
  return (
    <>
      <SystemPageMark />
    <div className="site">
      <SiteHeader />
      <main className="doc">
        <div className="notfound">
          <div className="nf-code" aria-hidden="true">403</div>
          <Movable page="forbidden" id="forbidden.title" type="text"><EditableText id="forbidden.title" as="h1" fallbacks={TITLE} fallback={TITLE.nl} /></Movable>
          <Movable page="forbidden" id="forbidden.body" type="text"><EditableText id="forbidden.body" as="p" fallbacks={BODY} fallback={BODY.nl} className="muted" /></Movable>
          <ForbiddenActions />
        </div>
        <PageBlocks pageKey="forbidden" />
      </main>
      <SiteFooter />
    </div>
    </>
  );
}
