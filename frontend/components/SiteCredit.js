// "© Easy2edit <year>" at the bottom of every page (can be switched off in Admin -> Overzicht -> Over Easy2edit)
export default function SiteCredit({ show }) {
  if (!show) return null;
  return (
    <div className="site-credit">
      <a href="https://easy2edit.com" target="_blank" rel="noopener noreferrer">© Easy2edit {new Date().getFullYear()}</a>
    </div>
  );
}
