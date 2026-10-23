/**
 * Funding acknowledgement required by the Startup Albania grant (Annex 1, visibility plan).
 * Shown at the bottom of every page, signed in or not. The logos are used as supplied, only cropped to their artwork.
 */
export function Funders() {
  return (
    <footer className="funders">
      <div className="funders-logos">
        <img
          className="ministry" src="/funders/ministry-of-economy-and-innovation.png" width={299} height={336}
          alt="Republic of Albania, Ministry of Economy and Innovation"
        />
        <img className="startup-albania" src="/funders/startup-albania.png" width={665} height={160} alt="Startup Albania" />
      </div>
      <p>
        The “Greecon” project is carried out with the financial support of the Albanian Government through the Ministry
        of Economy and Innovation, under the Grant 2026 scheme, and is implemented by the Innovation4Albania Agency.
      </p>
    </footer>
  );
}
