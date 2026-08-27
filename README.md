# VS Code Brainfuck Language Support & Visual Tape Debugger

VS Code için modern, zengin özellikli ve görsel olarak çarpıcı bir **Brainfuck** geliştirme ortamı.

![Brainfuck Visual Tape Debugger](https://raw.githubusercontent.com/Ohualtex/vscode-brainfuck/main/docs/preview.png)

---

## ⚡ Özellikler

### 1. 🎨 Gelişmiş Sözdizimi Vurgulama (Syntax Highlighting)
- 8 temel Brainfuck komutunu işlevsel kategorilerine göre renklendirir:
  - **Pointer Hareketleri (`>`, `<`):** Mavi/Cyan
  - **Değer Değişimi (`+`, `-`):** Yeşil
  - **I/O Komutları (`.`, `,`):** Kırmızı/Pembe
  - **Döngü Parantezleri (`[`, `]`):** Sarı/Amber
  - **Hata Ayıklama Breakpoint'i (`#`):** Magenta
  - **Yorumlar:** Diğer tüm karakterler otomatik olarak yorum biçiminde soluk renklendirilir.
- Parantez eşleştirme ve otomatik tamamlama desteği.

### 2. 🔍 Anlık Hata ve Tanılayıcı (Real-time Diagnostics)
- **Kapanmamış döngü parantezi (`[`):** Eşleşen `]` olmadığında kırmızı alt çizgi ile gösterilir.
- **Fazladan kapanış parantezi (`]`):** Önce gelen bir `[` olmadığında doğrudan işaretlenir.
- **İçi boş döngü uyarısı (`[]`):** Sonsuz döngü riski taşıyan yapılar için sarı uyarı üretir.

### 3. 📼 Görsel Bellek Bandı & Adım Adım Hata Ayıklayıcı (Visual Tape Debugger)
Webview tabanlı, yüksek performanslı ve akıcı bellek inceleyicisi:
- **Canlı Hücre İnceleme:** Her bir hücrenin Onluk (Decimal), Onaltılık (Hex) ve ASCII karakter karşılığı.
- **Aktif Hücre İşaretçisi (Pointer Indicator):** Dinamik neon çerçeve ve pointer oku.
- **Zaman Yolculuğu (Time-Travel Debugging):** 
  - **Step Next (`▶` / `Sağ Ok`):** Bir adım ileri git.
  - **Step Prev (`◀` / `Sol Ok`):** Bir adım geri git (durum, bellek ve çıktı geri sarılır!).
  - **Run / Pause (`Space`):** Ayarlanabilir hızda otomatik yürütme.
  - **Reset (`R`):** Bellek bandını ve çıktıyı sıfırlama.
- **Editör ile Çift Yönlü Senkronizasyon:** Yürütülen komut VS Code editöründe anlık olarak sarı vurgu ile parlar.
- **Hücre Değerini Düzenleme:** Herhangi bir hücreye tıklayarak değerini manuel değiştirebilme.
- **Girdi Tamponu:** `,` komutları için önceden girdi yazabilme veya adım adım girdi sağlayabilme.

### 4. 🚀 Hızlı Kod Çalıştırıcı (Output Channel Runner)
- Brainfuck kodunu editörün sağ üstündeki Run ikonuna basarak veya `Brainfuck: Run Code in Output Channel` komutuyla doğrudan çalıştırın.
- Çalışma süresi, toplam adım sayısı ve bellek kullanım istatistiklerini raporlar.

### 5. 🧹 Biçimlendirici (Formatter) & Minifier
- **Format Document (`Shift+Alt+P`):** Döngü bloklarını (`[` ve `]`) otomatik girintileyerek okunabilirliği artırır.
- **Minify Code:** Tüm boşlukları ve yorumları temizleyerek saf Brainfuck koduna dönüştürür.

### 6. 📝 Hazır Kod Parçacıkları (Snippets)
- `bf-hello` / `hello`: Hello World programı.
- `bf-clear` / `clear`: Hücre sıfırlama `[-]`.
- `bf-move`: Hücre taşıma `[->+<]`.
- `bf-copy`: Hücre kopyalama `[->+>+<<]>>[-<<+>>]<`.
- `bf-add` / `bf-sub`: Hücreler arası toplama / çıkarma.
- `bf-mult`: Çarpma işlemi şablonu.

---

## ⌨️ Kısayollar ve Komutlar

| Komut | Kısayol | Açıklama |
|---|---|---|
| `Brainfuck: Open Visual Tape Debugger` | Editör Üstü Buton | Görsel bellek bandını açar |
| `Brainfuck: Run Code in Output Channel` | Editör Üstü Buton | Kodu konsolda çalıştırır |
| `Brainfuck: Format / Indent Loops` | `Shift+Alt+F` | Kodu girintiler |
| `Brainfuck: Minify Code` | Komut Paleti | Yorum ve boşlukları temizler |

### Görsel Hata Ayıklayıcı İçinde:
- **`Space`**: Çalıştır / Duraklat (Play / Pause)
- **`Sağ Ok` (`→`)**: Bir adım ileri (Step Next)
- **`Sol Ok` (`←`)**: Bir adım geri (Step Prev / Undo)
- **`R`**: Sıfırla (Reset)

---

## ⚙️ Eklenti Ayarları

- `brainfuck.tapeSize`: Bellek boyutu (Varsayılan: `30000` hücre).
- `brainfuck.cellWrapping`: 8-bit taşma döngüsü (0 - 1 = 255, 255 + 1 = 0) (Varsayılan: `true`).
- `brainfuck.defaultRunDelayMs`: Görsel oynatıcıda adım başına gecikme ms cinsinden (Varsayılan: `30ms`).

---

## 🛠️ Geliştirme ve Test

```bash
# Bağımlılıkları yükleyin
npm install

# TypeScript ve Esbuild ile derleyin
npm run compile

# Birim testlerini çalıştırın
npm test

# F5 tuşuna basarak VS Code Extension Development Host penceresini açın!
```
