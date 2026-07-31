$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generator = Join-Path $projectRoot 'skills\generate-kitchen-game-art\scripts\generate_assets.py'
$manifest = Join-Path $PSScriptRoot 'cat10-manifest.json'
$outputDir = Join-Path $PSScriptRoot 'cat10'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Generate Cat Lv10'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(460, 150)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$label = New-Object System.Windows.Forms.Label
$label.Text = 'Enter a NEW image API key. It will not be saved.'
$label.Location = New-Object System.Drawing.Point(18, 18)
$label.AutoSize = $true
$form.Controls.Add($label)

$textBox = New-Object System.Windows.Forms.TextBox
$textBox.Location = New-Object System.Drawing.Point(20, 48)
$textBox.Size = New-Object System.Drawing.Size(420, 24)
$textBox.UseSystemPasswordChar = $true
$form.Controls.Add($textBox)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Text = 'Generate'
$okButton.Location = New-Object System.Drawing.Point(270, 96)
$okButton.Size = New-Object System.Drawing.Size(80, 30)
$okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($okButton)
$form.AcceptButton = $okButton

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = 'Cancel'
$cancelButton.Location = New-Object System.Drawing.Point(360, 96)
$cancelButton.Size = New-Object System.Drawing.Size(80, 30)
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.CancelButton = $cancelButton

$form.Add_Shown({ $textBox.Focus() })
$dialogResult = $form.ShowDialog()
if ($dialogResult -ne [System.Windows.Forms.DialogResult]::OK) {
    $form.Dispose()
    throw 'Image generation was cancelled.'
}

$apiKey = $textBox.Text
$textBox.Clear()
$form.Dispose()
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw 'No API key was entered.'
}

try {
    $env:IMAGE_MODEL = 'gpt-image-2'
    $env:IMAGE_BASE_URL = 'https://downstream.jbbtoken.cn'
    $env:IMAGE_API_KEY = $apiKey

    python $generator --manifest $manifest --output-dir $outputDir --check-config
    if ($LASTEXITCODE -ne 0) {
        throw 'Image generation configuration check failed.'
    }

    python $generator --manifest $manifest --output-dir $outputDir --only cat_10
    if ($LASTEXITCODE -ne 0) {
        throw 'Lv10 image generation failed.'
    }

    Write-Host 'Lv10 generation completed successfully.' -ForegroundColor Green
}
finally {
    Remove-Item Env:IMAGE_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:IMAGE_MODEL -ErrorAction SilentlyContinue
    Remove-Item Env:IMAGE_BASE_URL -ErrorAction SilentlyContinue
    $apiKey = $null
}
