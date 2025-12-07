# Chess Nerd

A suite of web-based chess tools.

### Core Tools

  * **PGN Info & Analytics**: A client-side PGN parser that generates instant statistics, extracts player/event metadata, and validates file integrity without uploading data to an external server.
  * **ECO Code Browser**: A hierarchical navigation tool for the Encyclopedia of Chess Openings (Volume A-E), allowing users to explore opening lines and variations.
  * **Tournament Archive**: A curated download center for historical tournament PGNs. Includes automatic calculation of average Elo and FIDE Tournament Categories based on player ratings.
  * **Engine Database**: A searchable reference for chess engines, filtering by name, author, language, and release details.
  * **Chess.com API Reference**: Documentation and reference tools for interacting with public chess data APIs.

### UI/UX

  * **Theme Engine**: Robust theming support with persistent dark/light mode toggles.
  * **Accent Customization**: Users can select from multiple color palettes (Burlywood, Teal, Cornflower, etc.) to match their aesthetic preference.
  * **Responsive Design**: Built with modern CSS Grid and Flexbox to work seamlessly across desktop and mobile devices.

## Tech Stack

  * **Frontend**: HTML5, CSS3 (CSS Variables for theming), Vanilla JavaScript (ES6+).
  * **Data Format**: JSON (for structured data like ECO codes and engines) and PGN (Portable Game Notation).
  * **Utilities**: Python (used for data scraping, calculating average Elo, and generating cross-tables).

## Project Structure

```text
chessnerd/
├── css/                # Global styles and theme definitions
├── js/                 # Application logic (PGN parsing, UI interaction)
├── data/               # Static JSON databases (ECO codes, engines)
├── tournaments/        # PGN archives and Python maintenance scripts
│   ├── calc_avg_elo.py # Utility to calculate FIDE categories
│   └── ...
├── index.html          # Main dashboard
└── [tool].html         # Individual tool interfaces
```

## Installation & Usage

### Running the Web Interface

Because Chess Nerd is built as a static site, it requires no complex build process or package manager.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/chess-nerd.git
    ```

2.  **Launch:**
    Simply open `index.html` in any modern web browser.

      * *Note: For strict CORS policies (loading JSON data), it is recommended to run a local server.*

    <!-- end list -->

    ```bash
    # Python 3 example
    cd chessnerd
    python -m http.server 8000
    ```
