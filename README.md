# Gia Phả - Website Quản Lý Cây Gia Đình

Website cá nhân để hiển thị và quản lý gia phả gia đình.

## Tính năng
- 🌳 Hiển thị cây gia phả trực quan
- 👨‍👩‍👧‍👦 Quản lý thành viên (thêm/sửa/xóa)
- 💑 Hiển thị quan hệ vợ/chồng, cha/mẹ - con
- 📊 Thống kê số thành viên, số đời
- 🔍 Zoom & kéo thả để xem
- 📥 Xuất/nhập dữ liệu JSON
- 📱 Responsive trên mobile
- 🆓 Hoàn toàn miễn phí

## Cách sử dụng

### Chạy local
Mở file `index.html` trực tiếp trên trình duyệt, hoặc:
```bash
npx serve .
```

### Deploy lên Vercel (miễn phí)
1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com), import repo
3. Deploy → xong!

### Deploy lên GitHub Pages (miễn phí)
1. Push code lên GitHub
2. Settings → Pages → Source: main branch
3. Website sẽ ở: `https://username.github.io/gia-pha`

## Cấu trúc
```
gia-pha/
├── index.html          # Trang chính
├── css/style.css       # Giao diện
├── js/
│   ├── data.js         # Quản lý dữ liệu
│   ├── tree.js         # Vẽ cây gia phả
│   └── app.js          # Logic ứng dụng
└── README.md
```

## Dữ liệu
- **Mặc định**: lưu trên trình duyệt (localStorage)
- **Nâng cấp**: kết nối Supabase để lưu online (cài đặt trong app)
