# Dartboard

Polski licznik X01 do darta z ręcznym wpisywaniem wyniku i automatycznym
punktowaniem z kamery.

## Uruchamianie

Otwórz folder projektu w VS Code i uruchom go przez serwer lokalny, np.
rozszerzenie Live Server. Możesz też uruchomić w folderze projektu:

```powershell
python -m http.server 8000
```

Otwórz `http://localhost:8000`. Przeglądarka udostępnia kamerę tylko w
bezpiecznym kontekście (HTTPS lub `localhost`). Przy pierwszym uruchomieniu
punktowania silnik Pyodide, NumPy i OpenCV zajmują około 27 MB; pliki są już
w folderze `vision/pyodide`, a obliczenia obrazu wykonywane są lokalnie w
przeglądarce.

## Punktowanie kamerą

Wybierz „Włącz kamerę”. Kamera potrzebuje widoku pustej tarczy z widocznym
całym zewnętrznym pierścieniem. Kalibracja rozpoczyna się automatycznie;
nie ma osobnego przycisku kalibracji. Przy pierwszym uruchomieniu orientacja
zakłada, że pole 20 jest u góry obrazu. Jej położenie zostaje zapisane, by
przy następnych kalibracjach automatycznych zachować orientację tarczy.

Kod oczekuje na stabilny obraz, porównuje kolejne klatki z obrazem sprzed
rzutu, wykrywa zmieniony kształt lotki, dopasowuje jej oś i przelicza grot
przez kalibrację perspektywy na pozycję na tarczy. Jedna kamera nie widzi
bezpośrednio głębokości grotu, więc przy niskiej pewności pokazuje
prawdopodobne pola do potwierdzenia. Można nadal korzystać z tarczy
interaktywnej lub ręcznie wpisać wynik wizyty.

## Pochodzenie kodu i licencja

Zmieniona kalibracja obrazu, wykrywanie lotki i obsługa kamery bazują na
[Darts S.A.M](https://github.com/SonicSamShop/darts-sam) Sam Cramphorna.
Wymagana informacja o autorstwie: **Based on Darts S.A.M by Sam Cramphorn**.
Oryginalne nagłówki autorstwa pozostawiono w skopiowanych modułach.
Projekt jest zmienioną, niezależną wersją, nieoficjalnie powiązaną z
Darts S.A.M. Więcej informacji o autorstwie i dodatkowych warunkach znajduje
się w pliku [NOTICE](./NOTICE); pełny tekst licencji jest w [LICENSE](./LICENSE).

Kod źródłowy Darts S.A.M jest udostępniony na warunkach GNU AGPL v3.
Zmodyfikowane moduły zachowują oryginalną licencję i informacje o autorstwie.
