# catotag

Maç sırasında akan bir zamanlayıcı üzerinde önceden tanımlı etiket butonlarına (Gol, Ofsayt…) basarak anları işaretleyen, sonra bu anları video düzenleme programlarına doğrudan aktarılabilen bir XML zaman çizelgesi olarak dışa aktaran web uygulaması.

Her etiket, tıklanan andan ayarlanabilir süre öncesi (`− sec`) ve sonrası (`+ sec`) kadar bir aralık olarak kaydedilir.

## Özellikler
- Duvar saatine dayalı zamanlayıcı: sekme arka plana alınsa, ekran kilitlense ya da sayfa yenilense bile süre doğru kalır
- Maç verisi her değişiklikte tarayıcıya otomatik kaydedilir ve açılışta geri yüklenir
- Maç sırasında ekran açık kalır (Wake Lock, HTTPS gerekir)
- Etiket başına ayrı ön/arka süre (ayarlanmamışsa varsayılan klip süresi)
- Basınca titreşim ve "geri al" seçenekli bildirim, eklenen anların listesi ve tek tek silme
- Buton düzeni editörü: butonları serbest ızgarada sürükleyip taşıma ve boyutlandırma, kolon sayısı ayarı
- Etiket setlerini düzeniyle birlikte preset olarak kaydetme
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
venv/bin/pip install -r requirements-dev.txt
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
venv/bin/python -m pytest tests   # testler
```

Ayarlar `.env` dosyalarından okunur; `.env` git'e eklenmez, örnekler `.env.example` içinde.
Varsayılan veritabanı SQLite'tır (`backend/catotag.db`), PostgreSQL için `DATABASE_URL` değiştirilir.
Frontend, `REACT_APP_API_URL` verilmezse sayfayı sunan makinenin 8000 portuna bağlanır; böylece aynı ağdaki
telefondan `http://<mac-ip>:3000` açınca backend'e de ulaşır.

## Hesap ve bulut yedekleme
Giriş yapmak isteğe bağlıdır; uygulama her durumda cihazda ve çevrimdışı çalışır.
Giriş yapılınca etiketler, düzen, varsayılan klip süresi, presetler ve maçlar arka planda hesaba yedeklenir,
başka cihazda giriş yapınca geri gelir. İnternet yoksa değişiklikler cihazda bekler ve bağlantı gelince yüklenir.
İki cihaz aynı ayarları değiştirirse hangisinin kalacağı sorulur. Kayıtlı maçların XML'i Account sayfasından indirilebilir.

## Veri güvenliği
- Şifreler bcrypt ile hash'lenir, düz metin hiçbir yerde tutulmaz.
- Oturum, `.env`'deki `SECRET_KEY` ile imzalanan JWT ile açılır (varsayılan 24 saat). Sahte ya da süresi dolmuş token reddedilir.
- Her sorgu kullanıcıyı token'dan alır; maçlar `(kullanıcı, maç id)` ile saklanır, başka kullanıcının verisi okunamaz, silinemez, üzerine yazılamaz.
- Aynı IP + kullanıcı adı için 15 dakikada 5 hatalı girişten sonra giriş geçici olarak engellenir; olmayan kullanıcı adı yanıt süresinden anlaşılamaz.
- Girdi doğrulama ve boyut sınırı (ayarlar 512 KB, maç 2 MB, kullanıcı başına 1000 maç).
- CORS sadece izin verilen adreslere açıktır; API yanıtları önbelleğe alınmaz.
- Hesap silme şifre onayı ister ve hesabın tüm verisini kalıcı olarak siler.
- Bu güvenceler `backend/tests/test_api.py` içinde test edilir.

### Yayına alırken
- Frontend ve backend **HTTPS** üzerinden yayınlanmalı (token ve şifre ağda şifreli gitsin; Wake Lock ve paylaşım menüsü de HTTPS ister).
- Üretimde yeni bir `SECRET_KEY` üret, `ENABLE_DOCS=false`, `CORS_ORIGIN_REGEX` boş, `CORS_ORIGINS` sadece gerçek frontend adresi.
- Kalıcı ve yedeklenen bir PostgreSQL kullan (SQLite tek sunuculu geliştirme içindir).
- Giriş denemesi sınırı tek süreçte bellekte tutulur; birden fazla sunucu süreci çalışacaksa Redis gibi ortak bir yere taşınmalı.
- Token tarayıcıda localStorage'da durur; bu yüzden sayfaya dışarıdan script eklenmemeli (React çıktıyı zaten kaçışlar).

Eski Flask sürümü git geçmişinde duruyor.
