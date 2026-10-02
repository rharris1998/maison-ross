// The button's five materials and two sizes (#29). Every button is a
// capsule. A press shows at once, as iOS's does under a finger, and eases
// back over --m-dur-press: gray and tinted deepen their fill, filled dims a
// little, glass shrinks (under reduced motion it takes a fill instead), and
// only plain fades, having no fill to change. A pointer (iPad, Mac) hovering
// a plain button draws its capsule. A disabled one turns gray (plain and glass
// keep their surface). A pending one (a write in flight: React Aria's
// isPending) keeps its material and its focus and dims a little, with no
// spinner and nothing that moves: its glyph and label fade to 70%, except on
// filled, whose blue fades to 85% instead so the white label stays as it is
// (3.3:1 light). Never the whole button's opacity, which would fade the focus
// ring it keeps; without color-mix() (Safari before 16.2) filled fades whole
// all the same. Its ProgressBar, there only to be read, is visually hidden.
// A regular button reaches a 44px hit area with the shared ::after inset.
export const buttonStyles = `
.m-button{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:0;border:0;border-radius:var(--m-radius-capsule);white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;appearance:none;-webkit-appearance:none;text-decoration:none;touch-action:manipulation;transition:opacity var(--m-dur-press) var(--m-ease),background-color var(--m-dur-press) var(--m-ease),transform var(--m-dur-press) var(--m-ease)}
.m-button--regular{height:var(--m-control);padding:0 16px;font:var(--m-type-subhead-strong)}
.m-button--regular::after{content:"";position:absolute;inset:-4px}
.m-button--regular .m-glyph{width:17px;height:17px}
.m-button--large{height:var(--m-control-large);padding:0 20px;font:var(--m-type-headline)}
.m-button--large .m-glyph{width:20px;height:20px}
.m-button--icon-only{padding:0;width:var(--m-control)}
.m-button--large.m-button--icon-only{width:var(--m-control-large)}
.m-button--wide{width:100%}
.m-button__label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.m-button--filled{background:var(--m-blue);color:var(--m-on-color)}
.m-button--tinted{background:var(--m-blue-fill);color:var(--m-blue-text)}
.m-button--gray{background:var(--m-fill-gray);color:var(--m-label)}
.m-button--plain{background:transparent;color:var(--m-blue-text)}
.m-button--glass{background:linear-gradient(180deg,var(--m-glass-top),var(--m-glass-bottom));-webkit-backdrop-filter:var(--m-glass-blur);backdrop-filter:var(--m-glass-blur);border:.5px solid var(--m-glass-border);box-shadow:var(--m-glass-highlight),var(--m-glass-shadow-small);color:var(--m-label)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.m-button--glass{background:var(--m-glass-fallback)}}
.m-button--plain[data-hovered]{background:var(--m-fill-gray)}
.m-button[data-pressed]{transition-duration:0ms}
.m-button--gray[data-pressed]{background:var(--m-fill-pressed)}
.m-button--tinted[data-pressed]{background:var(--m-blue-fill-pressed)}
.m-button--filled[data-pressed]{opacity:.8}
.m-button--plain[data-pressed]{opacity:.55}
.m-button--glass[data-pressed]{transform:scale(.94)}
@media (prefers-reduced-motion:reduce){.m-button--glass[data-pressed]{transform:none;box-shadow:inset 0 0 0 100px var(--m-glass-selected),var(--m-glass-highlight),var(--m-glass-shadow-small)}}
.m-button[data-disabled]{color:var(--m-label-3);cursor:default}
.m-button--filled[data-disabled],.m-button--tinted[data-disabled],.m-button--gray[data-disabled]{background:var(--m-fill-gray)}
.m-button>*{transition:opacity var(--m-dur-press) var(--m-ease)}
.m-button[data-pending]{cursor:default}
.m-button[data-pending]:not(.m-button--filled)>*{opacity:.7}
.m-button--filled[data-pending]{background:color-mix(in srgb,var(--m-blue) 85%,transparent)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-button--filled[data-pending]{opacity:.85}}
.m-button__progress{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;
