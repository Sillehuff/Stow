/* Mounts the Stow UX-enhancement canvas: 3 enhancements, each grounded in a
   principle from a best-in-class app, annotated with post-its. */
(function () {
  function mount() {
    if (!window.DesignCanvas || !window.EX_FIND || !window.EX_KEEP || !window.EX_CAP || !window.StowIcons || !window.MG || !window.EX) {
      return setTimeout(mount, 30);
    }
    const { DesignCanvas, DCSection, DCArtboard, DCPostIt } = window;
    const F = window.EX_FIND, K = window.EX_KEEP, C = window.EX_CAP;
    const W = 360, H = 760;

    function Studio() {
      return (
        <DesignCanvas>
          <DCSection id="find" title="1 · Retrieval as an answer, not a list"
            subtitle="Stow's whole reason to exist is answering “where's my…?”. So the top hit is rendered as a confident, actionable result — the way Find My and Spotlight resolve a query — and the moment of retrieval doubles as the moment you keep the data honest.">
            <DCArtboard id="f1" label="Search → answer card" width={W} height={H}><F.F1_Answer /></DCArtboard>
            <DCArtboard id="f2" label="Full wayfinding answer" width={W} height={H}><F.F2_Wayfind /></DCArtboard>
            <DCArtboard id="f3" label="Ask in plain language" width={W} height={H}><F.F3_Ask /></DCArtboard>
            <DCPostIt top={-6} right={70} rotate={2} width={210}>
              <b>Principle — recognition over recall.</b> The #1 hit becomes a result you act on, not a row you parse. “Still here / Moved it” keeps the location trustworthy.
            </DCPostIt>
          </DCSection>

          <DCSection id="keep" title="2 · Make “where things are” a living status"
            subtitle="Homes leak: things get lent, packed, sent for repair. Today they silently vanish from the shelf. Borrowing Linear's and Things' first-class status model, every item carries a glanceable state — and the app, not your memory, tracks who has what.">
            <DCArtboard id="m1" label="Home surfaces what's away" width={W} height={H}><K.M1_AwayHome /></DCArtboard>
            <DCArtboard id="m2" label="Status · progressive disclosure" width={W} height={H}><K.M2_StatusSheet /></DCArtboard>
            <DCArtboard id="m3" label="Loans the app remembers" width={W} height={H}><K.M3_Loans /></DCArtboard>
            <DCPostIt top={-6} right={70} rotate={-2} width={210}>
              <b>Principle — visibility of system status.</b> Loan fields appear only when “Lent out” is chosen (progressive disclosure); the nudge puts the remembering in the world, not your head.
            </DCPostIt>
          </DCSection>

          <DCSection id="capture" title="3 · Capture a whole shelf in one shot"
            subtitle="The reason inventory apps die is the cost of adding things. Quick Capture reads one still frame, detects every object in it, then turns filing into a fast, forgiving review stack — surfacing the least-confident detections first so you fix what's shaky and breeze through the rest. Closes with an undoable batch confirmation.">
            <DCArtboard id="c1" label="Captured frame · analyzing" width={W} height={H}><C.C1_Detect /></DCArtboard>
            <DCArtboard id="c2" label="Review · least-sure first" width={W} height={H}><C.C2_Review /></DCArtboard>
            <DCArtboard id="c3" label="Batch confirmed · undoable" width={W} height={H}><C.C3_Done /></DCArtboard>
            <DCPostIt top={-6} right={70} rotate={2} width={210}>
              <b>Honest about the model.</b> It's one still frame read on-device — not live tracking. Detections carry a match %; low-confidence ones surface first with the AI's ranked guesses, so you verify, not just trust.
            </DCPostIt>
          </DCSection>
        </DesignCanvas>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<Studio />);
  }
  mount();
})();
