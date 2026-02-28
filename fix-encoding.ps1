$files = Get-ChildItem -Path . -Include *.tsx,*.ts -Recurse -Exclude node_modules,dist,build | Where-Object { !$_.PSIsContainer }

foreach ($file in $files) {
    try {
        Write-Host "Processing: $($file.FullName)"
        
        # Read the file content with default encoding detection
        $content = Get-Content -Path $file.FullName -Raw -Encoding Default
        
        # Write it back as UTF-8 without BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        
        Write-Host "  ✓ Converted to UTF-8" -ForegroundColor Green
    }
    catch {
        Write-Host "  ✗ Error: $_" -ForegroundColor Red
    }
}

Write-Host "`nDone! All files converted to UTF-8 without BOM" -ForegroundColor Cyan
