const express = require('express');
const axios = require('axios');
const { XhsSigner } = require('xhs-signer'); // 这里使用了真实的签名库

const app = express();
app.use(express.json());

app.post('/search', async (req, res) => {
  try {
    const { keyword, cookieStr, noteType, sort, totalNumber } = req.body;
    
    // 参数准备
    const searchUrl = 'https://edith.xiaohongshu.com/api/sns/web/v1/search/notes';
    let sortType = 'general';
    if (sort === 1) sortType = 'time_descending';
    if (sort === 2) sortType = 'popularity_descending';
    let type = '0';
    if (noteType === 1) type = 'video';
    if (noteType === 2) type = 'normal';

    const query = new URLSearchParams({
      keyword, page: '1', page_size: String(totalNumber || 20), sort: sortType, note_type: type
    });
    const targetUrl = `${searchUrl}?${query.toString()}`;

    // 生成签名 (核心步骤)
    const signer = new XhsSigner(cookieStr); 
    const signResult = signer.sign(targetUrl);

    // 发送请求
    const response = await axios.get(targetUrl, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
        'X-S': signResult['X-S'],
        'X-T': signResult['X-T'],
        'Referer': `https://www.xiaohongshu.com/search_result?keyword=${keyword}`
      }
    });

    res.json({
      success: true,
      data: response.data.data
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 监听 Vercel 环境要求的端口
module.exports = app;