// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
export const IconHome = () => <svg {...p}><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>;
export const IconUsers = () => <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14.3c2.2.6 3.5 2.5 3.5 5.2" /></svg>;
export const IconUser = () => <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>;
export const IconMenu = () => <svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export const IconLogout = () => <svg {...p}><path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9" /></svg>;
export const IconShield = () => <svg {...p}><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>;
export const IconBack = () => <svg {...p}><path d="M15 6l-6 6 6 6" /></svg>;
export const IconPalette = () => <svg {...p}><path d="M12 3a9 9 0 100 18c1.2 0 2-.8 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.4-4-7.7-9-7.7z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14.5" cy="7" r="1" /></svg>;
export const IconGlobe = () => <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>;
export const IconHistory = () => <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconKey = () => <svg {...p}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" /></svg>;
export const IconImage = () => <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></svg>;
export const IconLock = () => <svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>;
export const IconUnlock = () => <svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></svg>;
export const IconArchive = () => <svg {...p}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4" /></svg>;
export const IconFolder = () => <svg {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>;
export const IconGrid = () => <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
export const IconGroup = () => <svg {...p}><circle cx="8" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15 15c3 0 6 1.4 6 4" /></svg>;
export const IconMail = () => <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
export const IconSearch = () => <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
export const IconFlask = () => <svg {...p}><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9V3" /><path d="M7.5 15h9" /></svg>;
export const IconBag = () => <svg {...p}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>;
export const IconReceipt = () => <svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></svg>;
export const IconChat = () => <svg {...p}><path d="M4 5h16v11H9l-5 4V5z" /></svg>;

// Single-colour line icons (currentColor): they take the text / house colour. No emoji in the UI.
const I = (d) => (props) => <svg {...p} {...props}>{d}</svg>;
export const IconHeart = I(<path d="M12 20.5C5 16 3 12.5 3 9.5a4.5 4.5 0 018-2.8 4.5 4.5 0 018 2.8c0 3-2 6.5-9 11z" />);
export const IconStar = I(<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />);
export const IconFriends = I(<><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M2.5 19c0-3.1 2.5-5 5.5-5s5.5 1.9 5.5 5M14 14.3c.8-.2 1.6-.3 2.5-.3 2.7 0 5 1.7 5 4.5" /></>);
export const IconPhone = I(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />);
export const IconVideo = I(<><rect x="3" y="6" width="12.5" height="12" rx="2" /><path d="M15.5 10.5l5.5-3v9l-5.5-3z" /></>);
export const IconPaperclip = I(<path d="M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.4 3.4 0 014.8 4.8L9.8 17.3a1.7 1.7 0 01-2.4-2.4l7.6-7.6" />);
export const IconMic = I(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>);
export const IconCamera = I(<><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IconEdit = I(<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />);
export const IconCheck = I(<path d="M4.5 12.5l5 5 10-11" />);
export const IconX = I(<path d="M6 6l12 12M18 6L6 18" />);
export const IconCart = I(<><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19.5" r="1.2" /><circle cx="17" cy="19.5" r="1.2" /></>);
export const IconSend = I(<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />);
export const IconGlobe2 = I(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9z" /></>);
export const IconSmile = I(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" /></>);
export const IconPin = I(<><path d="M12 21s-6.5-5.7-6.5-11A6.5 6.5 0 0112 3.5 6.5 6.5 0 0118.5 10c0 5.3-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const IconTrophy = I(<><path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5v1.5A3.5 3.5 0 008 11M16 6h3.5v1.5A3.5 3.5 0 0116 11M12 13v4M8.5 20h7" /></>);
export const IconBolt = I(<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />);
export const IconLink = I(<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />);
export const IconBriefcase = I(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18" /></>);
export const IconTruck = I(<><path d="M2.5 6h11v10h-11zM13.5 9.5H18l3 3.5v3h-7.5" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>);
export const IconEye = I(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = I(<path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0112 6c5 0 8.5 4 9.5 6-.4.8-1.3 2.1-2.7 3.3M6.4 7.6C4.4 9 3 11 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9M9.9 9.9a3 3 0 004.2 4.2" />);
export const IconSliders = I(<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />);
export const IconSettings = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>);
export const IconBell = I(<path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15zM10 21a2 2 0 004 0" />);
export const IconRefresh = I(<path d="M20 11a8 8 0 00-14.5-4.5M4 4v4h4M4 13a8 8 0 0014.5 4.5M20 20v-4h-4" />);

export const IconGift = (props) => <svg {...p} {...props}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8M12 8c-2.5 0-4.5-1-4.5-2.8S9.2 3 12 8zM12 8c2.5 0 4.5-1 4.5-2.8S14.8 3 12 8z" /></svg>;
export const IconCoffee = (props) => <svg {...p} {...props}><path d="M4 8h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM16 10h2a2.5 2.5 0 010 5h-2M7 3v2M10 3v2M13 3v2" /></svg>;
export const IconRocket = (props) => <svg {...p} {...props}><path d="M12 3c3.5 2 5.5 5.5 5 10l-2 2h-6l-2-2c-.5-4.500 1.500-8 5-10zM9 15l-3 3 .5 3 3-1M15 15l3 3-.5 3-3-1" /><circle cx="12" cy="10" r="1.500" /></svg>;
export const IconCard = (props) => <svg {...p} {...props}><rect x="3" y="5.500" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg>;
export const IconHelp = () => <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></svg>;
export const IconInfo = () => <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;

// One-colour line icons of the standard installations (Super admin): they follow the colour of the theme through currentColor
export const PRESET_ICONS = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" /></>,
  cart: <><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9" cy="19.5" r="1.2" /><circle cx="17" cy="19.5" r="1.2" /></>,
  building: <><path d="M5 21V4a1 1 0 011-1h8a1 1 0 011 1v17M15 9h3a1 1 0 011 1v11M3 21h18M9 7h2M9 11h2M9 15h2" /></>,
  handshake: <><path d="M2.5 11l4-4 4 1.5 3-1.5 4 3 3-1.5v6l-3 1.5-2.5 2.5a2 2 0 01-3 0l-.5-.5-1.5 1a2 2 0 01-2.8-.5L4.5 14zM10.5 8.5L14 12" /></>,
  heart: <path d="M12 20.5C5 16 3 12.5 3 9.5a4.5 4.5 0 018-2.8 4.5 4.5 0 018 2.8c0 3-2 6.5-9 11z" />,
  medal: <><circle cx="12" cy="15" r="5" /><path d="M8.5 10.7L6 3h4l2 4 2-4h4l-2.5 7.7M12 12.5v5" /></>,
  ribbon: <><path d="M12 14a5.5 5.5 0 10-5.5-5.5c0 2 1.5 3.7 3 5.2L8 21l4-2.5 4 2.5-2.5-7.3c1.5-1.5 3-3.2 3-5.2" /></>,
  tag: <><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z" /><circle cx="8" cy="8" r="1.3" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3M12 15v2" /></>,
  gamepad: <><rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7.5 10.5v4M5.5 12.5h4M15.5 11.5h.01M18 13.5h.01" /></>,
};
export const PresetIcon = ({ name, size = 26 }) => PRESET_ICONS[name] ? <svg {...p} width={size} height={size}>{PRESET_ICONS[name]}</svg> : null;
export const IconTrash = I(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />);
