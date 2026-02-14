param(
    [string]$OutputPath = "docs/titled-players-context.txt",
    [int]$JsonSampleSize = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $resolvedOutput = $OutputPath
} else {
    $resolvedOutput = Join-Path $repoRoot $OutputPath
}

$outputDir = Split-Path -Parent $resolvedOutput
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$lines = [System.Collections.Generic.List[string]]::new()

function Add-Line {
    param([string]$Text = "")
    $script:lines.Add($Text)
}

function Get-RepoPath {
    param([string]$RelativePath)
    return Join-Path $script:repoRoot $RelativePath
}

function Get-FileLanguage {
    param([string]$RelativePath)
    $ext = [System.IO.Path]::GetExtension($RelativePath).ToLowerInvariant()
    switch ($ext) {
        ".html" { return "html" }
        ".js" { return "javascript" }
        ".css" { return "css" }
        ".json" { return "json" }
        ".md" { return "markdown" }
        ".py" { return "python" }
        ".ps1" { return "powershell" }
        ".xml" { return "xml" }
        ".txt" { return "text" }
        default { return "text" }
    }
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Add-FullFileSection {
    param(
        [string]$RelativePath,
        [string]$Title = ""
    )
    $path = Get-RepoPath $RelativePath
    if (-not (Test-Path $path)) {
        Add-Line ("## Full File: [{0}]" -f $RelativePath)
        Add-Line ""
        Add-Line "[MISSING] $path"
        Add-Line ""
        return
    }

    $titleText = if ($Title) { $Title } else { $RelativePath }
    $lang = Get-FileLanguage $RelativePath
    $body = Get-Content -Path $path -Raw -Encoding UTF8

    Add-Line ("## Full File: {0}" -f $titleText)
    Add-Line ""
    Add-Line ("Source: {0}" -f $path)
    Add-Line ""
    Add-Line ("```{0}" -f $lang)
    Add-Line $body
    Add-Line '```'
    Add-Line ""
}

function Find-LineByContains {
    param(
        [string[]]$SourceLines,
        [string]$Needle,
        [int]$Occurrence = 1,
        [int]$StartLine = 1
    )
    if ($Occurrence -lt 1) {
        throw "Occurrence must be >= 1"
    }
    if ($StartLine -lt 1) {
        throw "StartLine must be >= 1"
    }

    $count = 0
    for ($i = $StartLine - 1; $i -lt $SourceLines.Count; $i++) {
        if ($SourceLines[$i].Contains($Needle)) {
            $count++
            if ($count -eq $Occurrence) {
                return $i + 1
            }
        }
    }
    throw "Marker not found: '$Needle' (occurrence $Occurrence)"
}

function Add-MarkerSection {
    param(
        [string]$RelativePath,
        [string]$Title,
        [string]$StartContains,
        [string]$EndContains,
        [int]$StartOccurrence = 1,
        [int]$EndOccurrence = 1,
        [bool]$IncludeEndLine = $true
    )
    $path = Get-RepoPath $RelativePath
    if (-not (Test-Path $path)) {
        Add-Line "## Section: `$RelativePath` - $Title"
        Add-Line ""
        Add-Line "[MISSING] $path"
        Add-Line ""
        return
    }

    $source = Get-Content -Path $path -Encoding UTF8
    $start = Find-LineByContains -SourceLines $source -Needle $StartContains -Occurrence $StartOccurrence
    $end = Find-LineByContains -SourceLines $source -Needle $EndContains -Occurrence $EndOccurrence -StartLine $start
    if (-not $IncludeEndLine) {
        $end--
    }
    if ($end -lt $start) {
        throw "Invalid section range for '$RelativePath': $start-$end"
    }

    Add-Line ("## Section: {0} - {1} (lines {2}-{3})" -f $RelativePath, $Title, $start, $end)
    Add-Line ""
    Add-Line ("Source: {0}" -f $path)
    Add-Line ""
    Add-Line '```text'
    for ($n = $start; $n -le $end; $n++) {
        $line = $source[$n - 1]
        Add-Line ("{0,5}: {1}" -f $n, $line)
    }
    Add-Line '```'
    Add-Line ""
}

function Add-JsonSnapshot {
    param(
        [string]$RelativePath,
        [int]$SampleCount
    )
    $path = Get-RepoPath $RelativePath
    if (-not (Test-Path $path)) {
        Add-Line "## JSON Snapshot"
        Add-Line ""
        Add-Line "[MISSING] $path"
        Add-Line ""
        return
    }

    $raw = Get-Content -Path $path -Raw -Encoding UTF8
    $players = $raw | ConvertFrom-Json

    $entryCount = @($players).Count
    $sha = Get-Sha256 -Path $path

    $titles = @($players | ForEach-Object { $_.title } | Sort-Object -Unique)
    $countries = @($players | ForEach-Object { $_.country } | Sort-Object -Unique)
    $keys = @($players[0].PSObject.Properties.Name | Sort-Object)

    $titleCounts = $players | Group-Object -Property title | Sort-Object Count -Descending
    $statusCounts = $players | Group-Object -Property status | Sort-Object Count -Descending

    $rapidNonZero = @($players | Where-Object { $_.rapid -gt 0 }).Count
    $blitzNonZero = @($players | Where-Object { $_.blitz -gt 0 }).Count
    $bulletNonZero = @($players | Where-Object { $_.bullet -gt 0 }).Count

    $rapidStats = $players | Measure-Object -Property rapid -Minimum -Maximum
    $blitzStats = $players | Measure-Object -Property blitz -Minimum -Maximum
    $bulletStats = $players | Measure-Object -Property bullet -Minimum -Maximum

    $sample = @($players | Select-Object -First $SampleCount)
    $sampleJson = $sample | ConvertTo-Json -Depth 5

    Add-Line "## JSON Snapshot"
    Add-Line ""
    Add-Line ("Source: {0}" -f $path)
    Add-Line ("- SHA256: {0}" -f $sha)
    Add-Line "- Entries: $entryCount"
    Add-Line "- Distinct titles: $($titles.Count) -> $($titles -join ', ')"
    Add-Line "- Distinct countries: $($countries.Count)"
    Add-Line "- Schema keys: $($keys -join ', ')"
    Add-Line "- Non-zero ratings: rapid=$rapidNonZero, blitz=$blitzNonZero, bullet=$bulletNonZero"
    Add-Line "- Rating ranges:"
    Add-Line "  - rapid: min=$($rapidStats.Minimum), max=$($rapidStats.Maximum)"
    Add-Line "  - blitz: min=$($blitzStats.Minimum), max=$($blitzStats.Maximum)"
    Add-Line "  - bullet: min=$($bulletStats.Minimum), max=$($bulletStats.Maximum)"
    Add-Line ""
    Add-Line "### Title Counts"
    Add-Line ""
    Add-Line "| Title | Count |"
    Add-Line "| --- | ---: |"
    foreach ($row in $titleCounts) {
        Add-Line "| $($row.Name) | $($row.Count) |"
    }
    Add-Line ""
    Add-Line "### Status Counts"
    Add-Line ""
    Add-Line "| Status | Count |"
    Add-Line "| --- | ---: |"
    foreach ($row in $statusCounts) {
        Add-Line "| $($row.Name) | $($row.Count) |"
    }
    Add-Line ""
    Add-Line "### JSON Sample (first $SampleCount rows)"
    Add-Line ""
    Add-Line '```json'
    Add-Line $sampleJson
    Add-Line '```'
    Add-Line ""
}

function Add-GitHistorySection {
    param(
        [string[]]$Paths,
        [int]$MaxLines = 30
    )
    Add-Line "## Recent Git History"
    Add-Line ""
    try {
        $args = @("-C", $script:repoRoot, "log", "--date=short", "--pretty=format:- %h | %ad | %s", "--")
        $args += $Paths
        $history = & git @args
        if (-not $history) {
            Add-Line "No history found."
            Add-Line ""
            return
        }

        $rows = @($history | Select-Object -First $MaxLines)
        foreach ($row in $rows) {
            Add-Line $row
        }
        Add-Line ""
    } catch {
        Add-Line "Unable to collect git history: $($_.Exception.Message)"
        Add-Line ""
    }
}

Add-Line "# Chess.com Titled Players Context Dump"
Add-Line ""
Add-Line "- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line "- Repo root: $repoRoot"
Add-Line "- Output: $resolvedOutput"
Add-Line ""
Add-Line "This dump is intended for LLM context handoff and workflow review."
Add-Line ""

Add-Line "## Included Files"
Add-Line ""
Add-Line "- Full: docs/titled-players-how-it-works.md"
Add-Line "- Full: docs/build_titled_players_context_dump.ps1"
Add-Line "- Full: titled-players.html"
Add-Line "- Full: titled-players.py"
Add-Line "- Partial: index.html (tool registration + card routing)"
Add-Line "- Partial: sitemap.xml (titled-players route)"
Add-Line "- Partial: chesscom-api.html (Titled Players endpoint reference section)"
Add-Line "- Snapshot: titled-players.json (schema, counts, samples)"
Add-Line ""

Add-JsonSnapshot -RelativePath "titled-players.json" -SampleCount $JsonSampleSize

Add-FullFileSection -RelativePath "docs/titled-players-how-it-works.md"
Add-FullFileSection -RelativePath "docs/build_titled_players_context_dump.ps1"
Add-FullFileSection -RelativePath "titled-players.html"
Add-FullFileSection -RelativePath "titled-players.py"

Add-MarkerSection `
    -RelativePath "index.html" `
    -Title "Tool registration + homepage card routing" `
    -StartContains "const tools = [" `
    -EndContains "renderToolGrid();" `
    -IncludeEndLine $true

Add-MarkerSection `
    -RelativePath "sitemap.xml" `
    -Title "Titled Players sitemap entry" `
    -StartContains "<loc>https://chessnerd.net/titled-players.html</loc>" `
    -EndContains "</url>" `
    -IncludeEndLine $true

Add-MarkerSection `
    -RelativePath "chesscom-api.html" `
    -Title "PubAPI Titled Players endpoint docs" `
    -StartContains 'id="pubapi-endpoint-titled"' `
    -EndContains 'id="pubapi-endpoint-player-stats"' `
    -IncludeEndLine $false

Add-GitHistorySection -Paths @("titled-players.py", "titled-players.json", "titled-players.html", "index.html", "sitemap.xml")

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
Set-Content -Path $resolvedOutput -Value $content -Encoding UTF8
Write-Output "Wrote: $resolvedOutput"
