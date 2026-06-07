/* Assembles the management-option studies onto a design canvas. Loaded last. */
(function () {
  function mount() {
    if (!window.DesignCanvas || !window.MGOptions || !window.MGCombined || !window.MGCust || !window.StowIcons || !window.MG) {
      return setTimeout(mount, 30);
    }
    const { DesignCanvas, DCSection, DCArtboard } = window;
    const O = window.MGOptions;
    const D = window.MGCombined;
    const C = window.MGCust;
    const W = 360, H = 760;

    function Studio() {
      return (
        <DesignCanvas>
          <DCSection id="opt-d" title="Option D · Recommended — A's entry + C's editor + B's drag, no mode"
            subtitle="The synthesis. ··· on a row is the one entry to management (A); it opens straight onto the full Edit Space sheet (C). B's reorder is folded into the list as a touch-and-hold drag — no separate edit mode — and area reordering lives inside the editor. The customizing studies that follow show how far the colour palette and icon set reach inside that Edit Space sheet: six curated colours + a rainbow ‘custom’ chip (expand inline or open a full spectrum + hex picker), and twelve inline icons + an ‘All 30’ searchable library by category.">
            <DCArtboard id="d1" label="List · ··· + hold-to-reorder" width={W} height={H}><D.D_List /></DCArtboard>
            <DCArtboard id="d2" label="Quick menu → Edit space" width={W} height={H}><D.D_Menu /></DCArtboard>
            <DCArtboard id="d3" label="Reorder in place (no mode)" width={W} height={H}><D.D_Reorder /></DCArtboard>
            <DCArtboard id="d4" label="Full Edit Space sheet" width={W} height={H}><D.D_Editor /></DCArtboard>
            <DCArtboard id="cc1" label="Color · resting · curated + custom chip" width={W} height={H}><C.C_Resting /></DCArtboard>
            <DCArtboard id="cc2" label="Color · inline expand · all presets" width={W} height={H}><C.C_Expand /></DCArtboard>
            <DCArtboard id="cc3" label="Color · picker sheet · spectrum + hex" width={W} height={H}><C.C_Picker /></DCArtboard>
            <DCArtboard id="ci1" label="Icon · resting · inline + View all tile" width={W} height={H}><C.I_Resting /></DCArtboard>
            <DCArtboard id="ci2" label="Icon · library · search + categories" width={W} height={H}><C.I_Library /></DCArtboard>
          </DCSection>

          <DCSection id="opt-a" title="Option A · Inline quick actions"
            subtitle="A ··· button (or long-press) on any space or area opens a native action sheet. Lightest touch, zero new screens, and the same gesture scales down to areas.">
            <DCArtboard id="a1" label="Affordance · ··· per row" width={W} height={H}><O.A_Trigger /></DCArtboard>
            <DCArtboard id="a2" label="Space menu" width={W} height={H}><O.A_Menu /></DCArtboard>
            <DCArtboard id="a3" label="Same pattern for areas" width={W} height={H}><O.A_Areas /></DCArtboard>
          </DCSection>

          <DCSection id="opt-b" title="Option B · Edit mode"
            subtitle="An Edit button flips the list into iOS-style management: drag to reorder, tap a name to rename inline, − to remove. Best when tidying several spaces at once.">
            <DCArtboard id="b1" label="Edit mode · reorder & remove" width={W} height={H}><O.B_EditMode /></DCArtboard>
            <DCArtboard id="b2" label="Inline rename" width={W} height={H}><O.B_Rename /></DCArtboard>
          </DCSection>

          <DCSection id="opt-c" title="Option C · Dedicated editor"
            subtitle="One Edit button opens a full sheet to rename, recolor, re-icon, and manage areas in one place — including a clearly-bounded destructive delete. Most thorough; matches the existing sheet-based add flow.">
            <DCArtboard id="c1" label="Entry point" width={W} height={H}><O.C_Entry /></DCArtboard>
            <DCArtboard id="c2" label="Edit Space sheet" width={W} height={H}><O.C_Editor /></DCArtboard>
          </DCSection>
        </DesignCanvas>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<Studio />);
  }
  mount();
})();
