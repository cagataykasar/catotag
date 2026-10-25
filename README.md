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

### Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm start
```

### Backend (FastAPI)
```bash
cd backend
cp .env.example .env   # SECRET_KEY'i doldur
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/uvicorn main:app --reload
```

Ayarlar `.env` dosyalarından okunur; `.env` git'e eklenmez, örnekler `.env.example` içinde.
Varsayılan veritabanı SQLite'tır, PostgreSQL için `DATABASE_URL` değiştirilir.

Backend şu an kullanıcı/giriş (JWT), etiket kaydı ve `/generate-xml` sunuyor. Frontend henüz ona bağlı değil;
XML tarayıcıda üretiliyor ve uygulama backend olmadan da tam çalışıyor.

Eski Flask sürümü git geçmişinde duruyor.
