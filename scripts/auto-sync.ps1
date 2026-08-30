<#
  auto-sync.ps1 — ローカルの変更を自動で commit して GitHub に push します。

  使い方:
    sync.cmd をダブルクリック（またはこのファイルを右クリック → PowerShell で実行）
    止めるときは Ctrl+C

  仕組み:
    数秒おきに git status を見て、「変更があって、かつ前回の確認から増えていない」
    ＝編集の手が止まったタイミングでまとめて commit / push します。
    保存のたびに履歴が刻まれるのではなく、作業が一段落したらまとまる動きです。

  オプション:
    -IntervalSeconds 30   確認間隔（既定 15 秒）
    -NoPush               commit だけして push しない
    -Once                 1 回だけ確認して終了（動作テスト用）
#>
param(
  [int]$IntervalSeconds = 15,
  [switch]$NoPush,
  [switch]$Once
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

git rev-parse --is-inside-work-tree > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "ここは Git リポジトリではありません: $repo" -ForegroundColor Red
  exit 1
}

$remote = (git remote 2>$null | Select-Object -First 1)
$hasRemote = -not [string]::IsNullOrWhiteSpace($remote)
$branch = (git rev-parse --abbrev-ref HEAD).Trim()

Write-Host ""
Write-Host "  Asian Social Rotterdam - auto sync" -ForegroundColor Cyan
Write-Host "  フォルダ : $repo"
Write-Host "  ブランチ : $branch"
if ($hasRemote) {
  Write-Host "  リモート : $remote  ($(git remote get-url $remote))"
} else {
  Write-Host "  リモート : 未設定 - commit のみ行います" -ForegroundColor Yellow
  Write-Host "             git remote add origin [URL] を実行すると push も始まります" -ForegroundColor Yellow
}
Write-Host "  間隔     : $IntervalSeconds 秒 / 止めるには Ctrl+C"
Write-Host ""

$previous = ''

while ($true) {
  $lines = @(git status --porcelain)
  $status = ($lines -join "`n")

  if ($status -ne '' -and $status -eq $previous) {
    $count = $lines.Count
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'

    git add -A
    git commit -q -m "Auto-sync $stamp ($count files)"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[$stamp] committed $count file(s)" -ForegroundColor Green

      if ($hasRemote -and -not $NoPush) {
        git push -q $remote $branch 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        if ($LASTEXITCODE -eq 0) {
          Write-Host "           pushed to $remote/$branch" -ForegroundColor Green
        } else {
          Write-Host "           push に失敗しました。初回は次を一度だけ実行してください:" -ForegroundColor Yellow
          Write-Host "           git push -u $remote $branch" -ForegroundColor Yellow
        }
      }
    }
    $previous = ''
  }
  else {
    if ($status -ne '' -and $status -ne $previous) {
      Write-Host "変更を検知しました。手が止まったらまとめて commit します..." -ForegroundColor DarkGray
    }
    $previous = $status
  }

  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
}
