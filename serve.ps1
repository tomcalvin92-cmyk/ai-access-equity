$root = "C:\Users\Mano\Documents\ai-access-equity"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:5173/")
$listener.Start()
Write-Output "Serving $root on http://localhost:5173/"

$mime = @{ ".html"="text/html"; ".css"="text/css"; ".js"="application/javascript"; ".json"="application/json"; ".png"="image/png"; ".svg"="image/svg+xml" }

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    $path = $req.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root ($path.TrimStart("/"))
    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $ct = $mime[$ext]
        if (-not $ct) { $ct = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentType = $ct
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.OutputStream.Close()
}
