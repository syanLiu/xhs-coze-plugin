const express = require('express');
const axios = require('axios');
const { XhsSigner } = require('xhs-signer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 增加 URL 解析支持

// 跨域处理
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 统一的逻辑处理函数
async function handleSearch(params) {
  const { keyword, cookieStr, noteType, sort, totalNumber } = params;

  if (!keyword || !cookieStr) {
    throw new Error('缺少关键词或Cookie');
  }

  const searchUrl = 'https://edith.xiaohongshu.com/api/sns/web/v1/search/notes';
  
  let sortType = 'general'; 
  if (sort == 1) sortType = 'time_descending'; 
  if (sort == 2) sortType = 'popularity_descending'; 

  let type = '0'; 
  if (noteType == 1) type = 'video';
  if (noteType == 2) type = 'normal';

  const query = new URLSearchParams({
    keyword: keyword,
    page: '1',
    page_size: String(totalNumber || 20),
    sort: sortType,
    note_type: type
  });

  const targetUrl = `${searchUrl}?${query.toString()}`;

  // 生成签名
  const signer = new XhsSigner(cookieStr); 
  const signResult = signer.sign(targetUrl);

  // 请求小红书
  const xhsResponse = await axios.get(targetUrl, {
    headers: {
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-S': signResult['X-S'],
      'X-T': signResult['X-T'],
      'Referer': `https://www.xiaohongshu.com/search_result?keyword=${keyword}`
    }
  });

  const items = xhsResponse.data.data?.items || [];
  const notes = items.map(item => {
    const note = item.model_type === 'note' ? item.note_card : null;
    if(!note) return null;
    return {
      id: note.id || note.note_id,
      title: note.display_title || note.title,
      desc: note.desc,
      cover: note.cover?.url_default || note.cover?.url,
      liked_count: note.interact_info?.liked_count || 0,
      collected_count: note.interact_info?.collected_count || 0,
      note_url: `https://www.xiaohongshu.com/explore/${note.note_id}`
    };
  }).filter(n => n !== null);

  return {
    success: true,
    data: { notes: notes, totalCount: notes.length }
  };
}

// 同时支持 GET 和 POST
app.all('/search', async (req, res) => {
  try {
    // 如果是 GET，参数在 req.query；如果是 POST，参数在 req.body
    // 这里做一个合并，无论哪种方式都能取到值
    const params = { ...req.query, ...req.body };
    
    console.log('收到请求参数:', params);
    
    const result = await handleSearch(params);
    res.json(result);
  } catch (error) {
    console.error('服务器内部错误:', error.message);
    res.status(500).json({
      success: false,
      message: '采集失败: ' + error.message
    });
  }
});

module.exports = app;