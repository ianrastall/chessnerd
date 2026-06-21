$response = Invoke-RestMethod -Uri "https://api.github.com/repos/ianrastall/titled-tuesday-archive/git/trees/main?recursive=1"
$zipFiles = $response.tree | Where-Object { $_.path -like "*.zip" }
$zipFiles | ForEach-Object { "https://github.com/ianrastall/titled-tuesday-archive/raw/main/$($_.path)" }