Add-Type -AssemblyName System.Xml
$kml = [xml][System.IO.File]::ReadAllText('C:\laragon\www\codec\temp\mv_evento_filtro_exportKML.kml')
$ns = New-Object System.Xml.XmlNamespaceManager($kml.NameTable)
$ns.AddNamespace('k', 'http://www.opengis.net/kml/2.2')
$placemarks = $kml.SelectNodes('//k:Placemark', $ns)

# Dia 26/06 BRT = 26/06T03:00Z ate 27/06T02:59Z
$dia26Start = [DateTime]::Parse("2026-06-26T03:00:00Z").ToUniversalTime()
$dia26End   = [DateTime]::Parse("2026-06-27T02:59:59Z").ToUniversalTime()

$criterio1_GO = 0  # dt_maxima no dia 26 BRT
$criterio2_GO = 0  # evento ATIVO no dia 26 (dt_minima <= fim26 AND dt_maxima >= inicio26)
$criterio2_eventos = @()

foreach ($p in $placemarks) {
    $simpleData = $p.SelectNodes('.//k:SimpleData', $ns)
    $props = @{}
    foreach ($sd in $simpleData) { $props[$sd.GetAttribute('name')] = $sd.'#text' }

    $uf = ($props['sigla_uf'] -replace '[{}]', '').Trim()
    if (-not $uf -or $uf -eq 'NULL') { continue }  # so UFs definidas
    
    # Pega apenas GO ou multi-estado contendo GO
    $isGO = ($uf -eq 'GO') -or ($uf -like '*GO*')
    if (-not $isGO) { continue }

    $dtMaxStr = $props['dt_maxima']
    $dtMinStr = $props['dt_minima']
    if (-not $dtMaxStr) { continue }

    try { $dtMax = [DateTime]::Parse($dtMaxStr).ToUniversalTime() } catch { continue }
    try { $dtMin = if ($dtMinStr) { [DateTime]::Parse($dtMinStr).ToUniversalTime() } else { $dtMax } } catch { $dtMin = $dtMax }

    $mun  = ($props['nome_municipio'] -replace '[{}]', '').Trim()
    $area = $props['area_total_evento']
    $det  = $props['qtd_deteccoes']

    # Criterio 1: dt_maxima cai no dia 26 BRT
    if ($dtMax -ge $dia26Start -and $dtMax -le $dia26End) {
        $criterio1_GO++
    }

    # Criterio 2: evento estava ATIVO em algum momento do dia 26
    # (iniciou antes do fim do dia 26 E terminou depois do inicio do dia 26)
    if ($dtMin -le $dia26End -and $dtMax -ge $dia26Start) {
        $criterio2_GO++
        $criterio2_eventos += [PSCustomObject]@{
            Municipio = $mun
            UF        = $uf
            DtMin     = $dtMinStr
            DtMax     = $dtMaxStr
            Area      = $area
            Det       = $det
        }
    }
}

Write-Host "================================================"
Write-Host " CONTAGEM DE EVENTOS EM GOIAS - DIA 26/06/2026"
Write-Host "================================================"
Write-Host ""
Write-Host "Criterio 1 - dt_maxima esta no dia 26 BRT:"
Write-Host "  Total GO: $criterio1_GO"
Write-Host ""
Write-Host "Criterio 2 - evento ATIVO no dia 26 (qualquer sobreposicao com o dia):"
Write-Host "  Total GO: $criterio2_GO"
Write-Host ""
Write-Host "--- Detalhe dos eventos ativos no dia 26 (Criterio 2) ---"
$i = 1
foreach ($ev in ($criterio2_eventos | Sort-Object DtMax)) {
    Write-Host "  [$i] Mun=$($ev.Municipio) | UF=$($ev.UF) | dtMin=$($ev.DtMin) | dtMax=$($ev.DtMax) | Area=$($ev.Area) ha | Det=$($ev.Det)"
    $i++
}
