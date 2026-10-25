# catotag

Maç sırasında akan bir zamanlayıcı üzerinde önceden tanımlı etiket butonlarına (Gol, Ofsayt…) basarak anları işaretleyen, sonra bu anları video düzenleme programlarına doğrudan aktarılabilen bir XML zaman çizelgesi olarak dışa aktaran web uygulaması.

Her etiket, tıklanan andan ayarlanabilir süre öncesi (`− sec`) ve sonrası (`+ sec`) kadar bir aralık olarak kaydedilir.

## Özellikler
- Duvar saatine dayalı zamanlayıcı: sekme arka plana alınsa, ekran kilitlense ya da sayfa yenilense bile süre doğru kalır
- Maç verisi her değişiklikte tarayıcıya otomatik kaydedilir ve açılışta geri yüklenir
- Maç sırasında ekran açık kalır (Wake Lock, HTTPS gerekir)
- Son etiketi geri alma (Undo)
- Telefonda paylaşım menüsüyle, masaüstünde doğrudan indirme ile XML dışa aktarma

## Çalıştırma
```bash
cd frontend
npm install
npm start
```

`backend/` (FastAPI) şu an frontend tarafından kullanılmıyor; XML tarayıcıda üretiliyor.

Eski Flask sürümü git geçmişinde duruyor.
