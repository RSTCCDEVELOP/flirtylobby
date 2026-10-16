import { EditableText } from "./EditMode";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import Link from "next/link";

const TITLE = { nl: "Pagina niet gevonden", en: "Page not found", de: "Seite nicht gefunden", fr: "Page introuvable", es: "Página no encontrada", pt: "Página não encontrada", zh: "页面未找到", ar: "الصفحة غير موجودة" };
const BODY = {
  nl: "Deze pagina bestaat niet (meer) of is verplaatst. Controleer het adres of ga terug naar de startpagina.",
  en: "This page does not exist (any more) or has moved. Check the address or go back to the home page.",
  de: "Diese Seite existiert nicht (mehr) oder wurde verschoben. Prüfe die Adresse oder gehe zurück zur Startseite.",
  fr: "Cette page n’existe plus ou a été déplacée. Vérifiez l’adresse ou retournez à l’accueil.",
  es: "Esta página ya no existe o se ha movido. Comprueba la dirección o vuelve al inicio.",
  pt: "Esta página já não existe ou foi movida. Verifique o endereço ou volte à página inicial.",
  zh: "此页面已不存在或已被移动。请检查地址或返回首页。",
  ar: "هذه الصفحة غير موجودة أو تم نقلها. تحقق من العنوان أو عد إلى الصفحة الرئيسية.",
};
const HOME = { nl: "Naar de startpagina", en: "Go to the home page", de: "Zur Startseite", fr: "Retour à l’accueil", es: "Ir al inicio", pt: "Ir para a página inicial", zh: "返回首页", ar: "إلى الصفحة الرئيسية" };

// The page for a wrong address (404). Title and text can be changed in edit mode, per language (Admin -> Pagina's -> 404).
export default function NotFoundView() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="doc notfound">
        <div className="nf-code" aria-hidden="true">404</div>
        <EditableText id="notfound.title" as="h1" fallbacks={TITLE} fallback={TITLE.nl} />
        <EditableText id="notfound.body" as="p" fallbacks={BODY} fallback={BODY.nl} className="muted" />
        <div><Link href="/" className="btn primary">{HOME.nl}</Link></div>
      </main>
      <SiteFooter />
    </div>
  );
}
