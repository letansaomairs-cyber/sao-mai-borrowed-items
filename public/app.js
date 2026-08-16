let dept='fb', adminPin='', manageOpen=false, lastReceipt=null, lastReceiptLang='vi';
const DEPTS={fb:{eyebrow:'F&B',title:'Quản lý công cụ F&B',items:['Ly thủy tinh','Ly rượu vang','Tách cà phê','Muỗng','Nĩa','Dao ăn','Đĩa','Tô','Khay','Xô đá','Bình nước','Dụng cụ mở rượu']},housekeeping:{eyebrow:'HOUSEKEEPING',title:'Quản lý công cụ Housekeeping',items:['Bàn ủi','Cầu là','Móc áo','Gối','Chăn','Khăn tắm','Khăn mặt','Máy sấy tóc','Ổ cắm nối dài','Nôi em bé','Ghế em bé']},reception:{eyebrow:'LỄ TÂN',title:'Quản lý công cụ Lễ tân',items:['Ô / dù','Adapter','Sạc điện thoại','Ổ cắm','Kéo','Cân hành lý','Bút','Bộ chuyển đổi điện','Dây sạc']}};
const $=s=>document.querySelector(s);
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(v){if(!v)return '-'; const d=new Date(v); if(Number.isNaN(d.getTime()))return esc(v); return d.toLocaleString('vi-VN');}
function fmtDay(v){if(!v)return '-'; const [y,m,d]=String(v).split('-'); return y&&m&&d?`${d}/${m}/${y}`:esc(v)}
function deptName(d){return d==='fb'?'F&B':d==='housekeeping'?'Housekeeping':'Lễ tân'}
function statusText(s){return {borrowing:'Đang mượn',partial:'Đã trả một phần',returned:'Đã trả đủ',resolved_issue:'Đã xử lý mất/hỏng'}[s]||s}
function padQty(v){return String(Math.max(1,Number(v)||1)).padStart(2,'0')}

const RECEIPT_TEXT={
  vi:{title:'PHIẾU XÁC NHẬN MƯỢN ĐỒ',code:'MÃ PHIẾU',guest:'Khách',room:'Phòng',department:'Bộ phận',item:'Đồ mượn',qty:'Số lượng',staff:'Nhân viên giao',borrowed:'Thời gian giao',expected:'Dự kiến trả',notes:'Ghi chú',photo:'Ảnh đồ mượn',rulesTitle:'XÁC NHẬN & QUY ĐỊNH MƯỢN ĐỒ',rule:(q,item)=>`Tôi xác nhận đã nhận thêm ${padQty(q)} ${item} từ Sao Mai Phu My Resort. Tôi có trách nhiệm bảo quản và hoàn trả ${item} khi sử dụng xong. Nếu làm mất, làm hỏng hoặc không hoàn trả, tôi đồng ý thanh toán phí bồi thường theo quy định của Sao Mai Phu My Resort.`,guestSign:'KHÁCH XÁC NHẬN',staffSign:'NHÂN VIÊN GIAO',signNote:'Ký và ghi rõ họ tên',place:'Phú Mỹ'},
  en:{title:'BORROWED ITEM CONFIRMATION',code:'RECEIPT CODE',guest:'Guest',room:'Room',department:'Department',item:'Borrowed item',qty:'Quantity',staff:'Staff handing over',borrowed:'Hand-over time',expected:'Expected return',notes:'Notes',photo:'Borrowed item photo',rulesTitle:'CONFIRMATION & BORROWING TERMS',rule:(q,item)=>`I confirm that I have received ${padQty(q)} ${item} from Sao Mai Phu My Resort. I am responsible for keeping the item(s) in good condition and returning them after use. In case of loss, damage, or failure to return the item(s), I agree to pay the applicable compensation fee in accordance with Sao Mai Phu My Resort's regulations.`,guestSign:'GUEST CONFIRMATION',staffSign:'STAFF HANDING OVER',signNote:'Signature and full name',place:'Phu My'},
  zh:{title:'借用物品确认单',code:'确认单编号',guest:'客人姓名',room:'房号',department:'部门',item:'借用物品',qty:'数量',staff:'交付员工',borrowed:'交付时间',expected:'预计归还',notes:'备注',photo:'借用物品照片',rulesTitle:'确认与借用规定',rule:(q,item)=>`本人确认已从 Sao Mai Phu My Resort 领取 ${padQty(q)} 件 ${item}。本人有责任妥善保管并在使用完毕后归还该物品。如发生遗失、损坏或未归还的情况，本人同意按照 Sao Mai Phu My Resort 的规定支付相应赔偿费用。`,guestSign:'客人确认',staffSign:'交付员工',signNote:'签名并填写姓名',place:'富美'},
  ko:{title:'대여 물품 확인서',code:'확인서 번호',guest:'고객명',room:'객실',department:'부서',item:'대여 물품',qty:'수량',staff:'인계 직원',borrowed:'인계 시간',expected:'예상 반납일',notes:'비고',photo:'대여 물품 사진',rulesTitle:'확인 및 대여 규정',rule:(q,item)=>`본인은 Sao Mai Phu My Resort로부터 ${padQty(q)}개의 ${item}을 수령했음을 확인합니다. 본인은 해당 물품을 안전하게 보관하고 사용 후 반납할 책임이 있습니다. 분실, 파손 또는 미반납 시 Sao Mai Phu My Resort의 규정에 따른 배상금을 지불하는 데 동의합니다.`,guestSign:'고객 확인',staffSign:'인계 직원',signNote:'서명 및 성명',place:'푸미'}
};

function renderDept(){const d=DEPTS[dept]; $('#deptEyebrow').textContent=d.eyebrow;$('#deptTitle').textContent=d.title;$('#itemSuggestions').innerHTML=d.items.map(x=>`<option value="${esc(x)}">`).join('');document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.dept===dept));updateRegulationPreview();if(manageOpen)loadRows();}
function updateRegulationPreview(){const form=$('#loanForm');const q=form.qty?.value||1;const item=form.item_name?.value.trim()||'đồ dùng';const lang=$('#receiptLang').value||'vi';$('#regulationPreview').textContent=RECEIPT_TEXT[lang].rule(q,item)}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{dept=b.dataset.dept;renderDept()});
$('#loanForm').addEventListener('input',e=>{if(['qty','item_name','receipt_lang'].includes(e.target.name))updateRegulationPreview()});
$('#receiptLang').onchange=updateRegulationPreview;

$('#loanImage').onchange=()=>{const f=$('#loanImage').files[0];const box=$('#imagePreview');box.innerHTML='';box.classList.add('hidden');if(!f)return;if(f.size>5*1024*1024){$('#loanImage').value='';return alert('Ảnh tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn.')}if(!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)){ $('#loanImage').value=''; return alert('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.'); }const url=URL.createObjectURL(f);box.innerHTML=`<img src="${url}" alt="Xem trước"><span>${esc(f.name)} · ${(f.size/1024/1024).toFixed(2)} MB</span>`;box.classList.remove('hidden')};

$('#loanForm').onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  fd.set('department',dept);
  const f=fd.get('image');
  if(f instanceof File && f.size>5*1024*1024)return alert('Ảnh tối đa 5MB.');
  const btn=e.submitter; if(btn)btn.disabled=true;
  try{
    const r=await fetch('/api/loans',{method:'POST',body:fd});
    const j=await r.json();
    if(!r.ok)return alert(j.error||'Không tạo được phiếu');
    lastReceipt=j.row; lastReceiptLang=fd.get('receipt_lang')||'vi';
    $('#createResult').innerHTML=`<div class="result-ok"><b>Đã tạo phiếu ${esc(j.code)}</b> · ${deptName(dept)} · Phòng ${esc(j.row.room_no)} · ${esc(j.row.qty)} × ${esc(j.row.item_name)}</div>`;
    renderReceipt(lastReceipt,lastReceiptLang);
    $('#receiptSection').classList.remove('hidden');
    $('#receiptSection').scrollIntoView({behavior:'smooth',block:'start'});
    e.target.reset(); e.target.qty.value=1; $('#receiptLang').value='vi'; $('#imagePreview').innerHTML=''; $('#imagePreview').classList.add('hidden'); updateRegulationPreview();
    if(manageOpen)loadRows();
  }finally{if(btn)btn.disabled=false;}
};

function renderReceipt(row,lang){
  if(!row)return; lastReceiptLang=lang; const t=RECEIPT_TEXT[lang]||RECEIPT_TEXT.vi;
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
  const image=row.image_url?`<div class="receipt-photo"><div class="receipt-label">${esc(t.photo)}</div><img src="${esc(row.image_url)}" alt="${esc(row.item_name)}"></div>`:'';
  const now=new Date(row.created_at); const dateText=Number.isNaN(now.getTime())?esc(row.created_at):now.toLocaleString(lang==='vi'?'vi-VN':lang==='zh'?'zh-CN':lang==='ko'?'ko-KR':'en-GB');
  const expected=fmtDay(row.expected_return_date);
  $('#receipt').innerHTML=`
    <div class="receipt-head"><img src="/sao-mai-logo.jpg" alt="Logo"><div><h2>${esc(t.title)}</h2><p>SAO MAI PHU MY RESORT · PHÚ MỸ, VIỆT NAM</p></div></div>
    <div class="receipt-code"><span>${esc(t.code)}</span><b>${esc(row.code)}</b></div>
    <div class="receipt-info">
      <div><span>${esc(t.guest)}</span><b>${esc(row.guest_name)}</b></div><div><span>${esc(t.room)}</span><b>${esc(row.room_no)}</b></div>
      <div><span>${esc(t.department)}</span><b>${esc(deptName(row.department))}</b></div><div><span>${esc(t.staff)}</span><b>${esc(row.staff_name||'-')}</b></div>
      <div><span>${esc(t.item)}</span><b>${esc(row.item_name)}</b></div><div><span>${esc(t.qty)}</span><b>${esc(row.qty)}</b></div>
      <div><span>${esc(t.borrowed)}</span><b>${dateText}</b></div><div><span>${esc(t.expected)}</span><b>${expected}</b></div>
      ${row.notes?`<div class="receipt-wide"><span>${esc(t.notes)}</span><b>${esc(row.notes)}</b></div>`:''}
    </div>
    ${image}
    <div class="receipt-rules"><h3>${esc(t.rulesTitle)}</h3><p>${esc(t.rule(row.qty,row.item_name))}</p></div>
    <div class="receipt-date">${esc(t.place)}, ${new Date(row.created_at).toLocaleDateString(lang==='vi'?'vi-VN':lang==='zh'?'zh-CN':lang==='ko'?'ko-KR':'en-GB')}</div>
    <div class="receipt-signatures"><div><b>${esc(t.guestSign)}</b><span>${esc(t.signNote)}</span><i></i></div><div><b>${esc(t.staffSign)}</b><span>${esc(t.signNote)}</span><i></i></div></div>`;
}
document.querySelectorAll('.lang-btn').forEach(b=>b.onclick=()=>{if(lastReceipt)renderReceipt(lastReceipt,b.dataset.lang)});
$('#printReceipt').onclick=()=>window.print();
$('#newReceipt').onclick=()=>{$('#receiptSection').classList.add('hidden');$('#loanForm').scrollIntoView({behavior:'smooth'})};

$('#openManage').onclick=()=>{adminPin=$('#adminPin').value.trim();if(!adminPin)return alert('Nhập PIN quản lý');manageOpen=true;$('#manageArea').classList.remove('hidden');loadRows()};
$('#refreshBtn').onclick=loadRows;$('#searchQ').oninput=()=>{clearTimeout(window._qt);window._qt=setTimeout(loadRows,250)};$('#statusFilter').onchange=loadRows;
async function loadRows(){const q=$('#searchQ').value.trim(),st=$('#statusFilter').value;const u=new URL('/api/loans',location.origin);u.searchParams.set('department',dept);if(q)u.searchParams.set('q',q);if(st)u.searchParams.set('status',st);const r=await fetch(u,{headers:{'x-admin-pin':adminPin}});const j=await r.json();if(!r.ok){manageOpen=false;$('#manageArea').classList.add('hidden');return alert(j.error||'Không mở được danh sách')}const rows=j.rows||[];$('#stOpen').textContent=rows.filter(x=>x.remaining_qty>0).length;$('#stItems').textContent=rows.reduce((a,x)=>a+x.remaining_qty,0);$('#stReturned').textContent=rows.filter(x=>x.status==='returned').length;$('#stIssue').textContent=rows.filter(x=>x.status==='resolved_issue').length;$('#loanRows').innerHTML=rows.map(rowHtml).join('')||'<tr><td colspan="10">Chưa có dữ liệu.</td></tr>'}
function rowHtml(r){const img=r.image_url?`<a href="${esc(r.image_url)}" target="_blank" class="thumb-link"><img src="${esc(r.image_url)}" class="thumb" alt="Ảnh"></a>`:'<span class="no-photo">—</span>';return `<tr><td>${img}</td><td><b>${esc(r.code)}</b><br><small>${esc(deptName(r.department))}</small></td><td><b>${esc(r.guest_name)}</b><br>Phòng ${esc(r.room_no)}${r.staff_name?`<br><small>NV: ${esc(r.staff_name)}</small>`:''}</td><td>${esc(r.item_name)}${r.notes?`<br><small>${esc(r.notes)}</small>`:''}</td><td>${r.qty}<br><small>Trả ${r.returned_qty} · Mất ${r.lost_qty} · Hỏng ${r.damaged_qty}</small></td><td><b>${r.remaining_qty}</b></td><td>${fmtDate(r.created_at)}</td><td>${fmtDay(r.expected_return_date)}</td><td><span class="badge ${esc(r.status)}">${esc(statusText(r.status))}</span></td><td><div class="row-actions">${r.remaining_qty>0?`<button class="secondary" onclick="act(${r.id},'return_one')">Trả 1</button><button class="secondary" onclick="act(${r.id},'return_all')">Trả hết</button><button class="warn" onclick="act(${r.id},'lost_one')">Mất 1</button><button class="warn" onclick="act(${r.id},'damaged_one')">Hỏng 1</button>`:''}<button class="secondary" onclick="printLoan(${r.id})">Phiếu</button><button class="danger" onclick="delLoan(${r.id})">Xóa</button></div></td></tr>`}
window.act=async(id,action)=>{if(['lost_one','damaged_one'].includes(action)&&!confirm('Xác nhận thao tác này?'))return;const r=await fetch(`/api/loans/${id}`,{method:'PATCH',headers:{'content-type':'application/json','x-admin-pin':adminPin},body:JSON.stringify({action})});const j=await r.json();if(!r.ok)return alert(j.error||'Có lỗi');loadRows()};
window.delLoan=async id=>{if(!confirm('Chỉ xóa khi phiếu tạo sai. Xác nhận xóa?'))return;const r=await fetch(`/api/loans/${id}`,{method:'DELETE',headers:{'x-admin-pin':adminPin}});const j=await r.json();if(!r.ok)return alert(j.error||'Có lỗi');loadRows()};
window.printLoan=async id=>{const r=await fetch(`/api/loans/${id}`,{headers:{'x-admin-pin':adminPin}});const j=await r.json();if(!r.ok)return alert(j.error||'Không mở được phiếu');lastReceipt=j.row;renderReceipt(lastReceipt,'vi');$('#receiptSection').classList.remove('hidden');$('#receiptSection').scrollIntoView({behavior:'smooth'})};
$('#checkoutBtn').onclick=async()=>{const room=$('#checkoutRoom').value.trim(),pin=$('#checkoutPin').value.trim();if(!room||!pin)return alert('Nhập số phòng và PIN quản lý');const r=await fetch(`/api/checkout?room=${encodeURIComponent(room)}`,{headers:{'x-admin-pin':pin}});const j=await r.json();if(!r.ok)return alert(j.error||'Không kiểm tra được');if(j.clear){$('#checkoutResult').innerHTML=`<div class="check-ok"><b>✓ PHÒNG ${esc(room)}: KHÔNG CÒN ĐỒ CHƯA TRẢ</b><br>Có thể tiếp tục quy trình checkout.</div>`}else{$('#checkoutResult').innerHTML=`<div class="check-alert"><b>⚠ PHÒNG ${esc(room)} CÒN ${j.open.reduce((a,x)=>a+x.remaining_qty,0)} MÓN CHƯA THU HỒI</b><div class="check-list">${j.open.map(x=>`<div class="check-item">${x.image_url?`<img src="${esc(x.image_url)}" class="checkout-thumb" alt="Ảnh">`:''}<span><b>${esc(deptName(x.department))}</b> · ${esc(x.item_name)} · còn <b>${x.remaining_qty}</b> · mã ${esc(x.code)}</span></div>`).join('')}</div></div>`}};
renderDept();
