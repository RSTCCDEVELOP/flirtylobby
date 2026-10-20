"use client";

import { IconCard, IconCoffee, IconGift, IconHeart, IconRocket, IconSmile, IconStar } from "./Icons";

export const BUTTON_ICONS = { heart: IconHeart, gift: IconGift, coffee: IconCoffee, star: IconStar, rocket: IconRocket, smile: IconSmile, card: IconCard };

// The look of a system-object button: icon + text, a style (primary / outline / soft / gradient), size, corner and an own colour.
export default function SysButton({ button = {}, label, onClick, type = "button", disabled, as: As = "button", ...rest }) {
  const Icon = BUTTON_ICONS[button.icon];
  const style = button.color ? { "--sb": button.color } : undefined;
  return (
    <As type={As === "button" ? type : undefined} className={`sys-btn ${button.variant || "primary"} s-${button.size || "md"} r-${button.radius || "default"}`} style={style} onClick={onClick} disabled={disabled} {...rest}>
      {Icon && <Icon width={18} height={18} />}
      <span>{label}</span>
    </As>
  );
}
