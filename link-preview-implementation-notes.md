# ملاحظات تنفيذ معاينات روابط المنشورات

## قرار التنفيذ

سيُنشأ مسار Vercel Function داخل `api/` لإرجاع نسخة HTML الخاصة بـ`/post/<id>` بعد حقن بيانات Open Graph وTwitter Card المستخرجة من سجل المنشور. يبقى جسم الصفحة هو واجهة MIX GOLD نفسها، ولذلك يستمر فتح الرابط داخل الموقع كما هو، بينما تقرأ منصات التواصل بيانات المعاينة من رأس الصفحة مباشرة.

## مرجع خارجي

يوضح توثيق Vercel الرسمي أن إنشاء ملف داخل مجلد `api/` في جذر المشروع ينشئ Vercel Function دون إعداد إضافي، وأنه يمكن استخدام معالج Node أو واجهة Web `fetch` لردود HTTP الديناميكية. كما يوضح توثيق `vercel.json` أن وظائف Vercel لا تحتاج تكوينًا خاصًا افتراضيًا عند وجود هذا المجلد.

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration/vercel-json
