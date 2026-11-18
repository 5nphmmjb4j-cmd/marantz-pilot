# Notatki o sterowaniu Marantz NR1602

Odkrycia z budowy projektu (mogą się różnić w innych modelach).

## Trzy interfejsy
1. **goform (HTTP, port 80)** — zapis: `GET /goform/formiPhoneAppDirect.xml?<cmd>` (np. `MV45`, `PWON`, `SIDVD`, `MSSTEREO`, `Z2ON`). Odczyt: `/goform/formMainZone_MainZoneXml.xml`, `formMainZone_MainZoneXmlStatus.xml`, `formZone2_Zone2XmlStatus.xml`, `formNetAudio_StatusXml.xml`, `formTuner_TunerXml.xml`.
2. **Telnet (port 23)** — komendy tekstowe zakończone `\r`. Amplituner przyjmuje **jedno połączenie naraz** (kolejne: „Connection refused”) — stosuj ponowienia.
3. **Panel WWW** (`/NetAudio/index.put.asp`, `/SETUP/...`) — nawigacja po listach radia (CurUp/CurDown/Enter) i ustawienia (formularze `.asp`).

## Odczyty telnet
`PSTONE CTRL ?`, `PSBAS ?`, `PSTRE ?`, `SLP?`, `PSDYNVOL ?`, `PSDYNEQ ?`, `CV?`, `TFAN?` (np. `TFAN009600` = 96,00 MHz), `TPAN?` (np. `TPANA1`).

## Zapisy użyte w aplikacji
`PSTONE CTRL ON|OFF`, `PSBAS nn` / `PSTRE nn` (50 = 0 dB, 44–56 = ±6 dB), `SLPOFF` / `SLP015`, `PSDYNVOL OFF|LIT|MED|HEV`, `PSDYNEQ ON|OFF`, `TFANUP/TFANDOWN` (krok 0,1 MHz), `TPANUP/TPANDOWN`.

## Pułapki
- Bas/wysokie działają tylko przy włączonym tone control.
- Odczyt XML tunera spóźnia się ~1 s po zmianie częstotliwości.
- Serwer HTTP amplitunera jest delikatny — zapytania warto serializować (w `server.py` robi to `AMP_LOCK`).
- Wejście `TUNER` może być ukryte: Setup → Manual Setup → Option → Source Delete (formularz `d_option1.asp` → `s_option1.asp`).
- Stacje radiowe dodaje się przez vTuner (`radiomarantz.com`, konto powiązane z adresem MAC amplitunera) lub z menu Option amplitunera; interfejs WWW nie ma „dodaj ulubioną”.
