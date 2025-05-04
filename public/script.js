// 表单验证函数
function validateForm() {
    const errors = [];
    const form = document.getElementById('repairForm');
    
    // 清除所有错误提示
    clearErrors();
    
    // 获取表单字段
    const school = form.school.value.trim();
    const building = form.building.value.trim();
    const room = form.room.value.trim();
    const description = form.description.value.trim();
    const phone = form.phone.value.trim();
    const appointmentTime = form.appointmentTime.value;
    const photo = form.photo.files[0];
    const campus = form.campus.value.trim();

    let firstErrorField = null; // 记录第一个错误的字段

    // 学校验证
    if (!school || school.length < 1 || school.length > 50) {
        showFieldError('school', '学校名称必须在1-50个字符之间');
        errors.push('学校名称必须在1-50个字符之间');
        firstErrorField = firstErrorField || 'school';
    }

    // 校区验证（选填）
    if (campus && (campus.length < 1 || campus.length > 20)) {
        showFieldError('campus', '校区信息必须在1-20个字符之间');
        errors.push('校区信息必须在1-20个字符之间');
        firstErrorField = firstErrorField || 'campus';
    }

    // 楼栋验证
    if (!building || building.length < 1 || building.length > 20) {
        showFieldError('building', '楼栋信息必须在1-20个字符之间');
        errors.push('楼栋信息必须在1-20个字符之间');
        firstErrorField = firstErrorField || 'building';
    }

    // 房间号验证
    if (!room || room.length < 1 || room.length > 10) {
        showFieldError('room', '房间号必须在1-10个字符之间');
        errors.push('房间号必须在1-10个字符之间');
        firstErrorField = firstErrorField || 'room';
    }

    // 故障描述验证
    if (!description || description.length < 1 || description.length > 500) {
        showFieldError('description', '故障描述必须在1-500个字符之间');
        errors.push('故障描述必须在1-500个字符之间');
        firstErrorField = firstErrorField || 'description';
    }

    // 手机号验证（可选）
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        showFieldError('phone', '请输入有效的手机号码');
        errors.push('请输入有效的手机号码');
        firstErrorField = firstErrorField || 'phone';
    }

    // 预约时间验证
    if (!appointmentTime) {
        showFieldError('appointmentTime', '预约时间不能为空');
        errors.push('预约时间不能为空');
        firstErrorField = firstErrorField || 'appointmentTime';
    } else {
        const appointmentDate = new Date(appointmentTime);
        const now = new Date();
        if (appointmentDate < now) {
            showFieldError('appointmentTime', '预约时间不能早于当前时间');
            errors.push('预约时间不能早于当前时间');
            firstErrorField = firstErrorField || 'appointmentTime';
        }
    }

    // 照片验证
    const previewContainer = document.getElementById('imagePreview');
    if (previewContainer.children.length > 5) {
        showFieldError('photo', '最多只能上传5张图片');
        errors.push('最多只能上传5张图片');
        firstErrorField = firstErrorField || 'photo';
    }

    // 如果有错误，滚动到第一个错误字段的位置
    if (firstErrorField) {
        const errorElement = document.getElementById(firstErrorField);
        if (errorElement) {
            errorElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
        }
    }

    return errors;
}

// 显示字段错误
function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}-error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    highlightError(fieldId);
}

// 高亮显示错误字段
function highlightError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');
        
        // 移除错误高亮
        field.addEventListener('input', function() {
            this.classList.remove('error');
            const errorElement = document.getElementById(`${fieldId}-error`);
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }, { once: true });
    }
}

// 实时字数统计
function setupCharacterCount(inputId, counterId, maxLength) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    
    function updateCount() {
        const currentLength = input.value.length;
        const remaining = maxLength - currentLength;
        
        if (remaining >= 0) {
            counter.textContent = `还可输入 ${remaining} 个字符`;
            counter.style.color = '#666';
        } else {
            counter.textContent = `已超出 ${Math.abs(remaining)} 个字符`;
            counter.style.color = 'red';
            // 截断超出的文本
            input.value = input.value.slice(0, maxLength);
        }
    }
    
    // 添加 maxlength 属性
    input.setAttribute('maxlength', maxLength);
    
    input.addEventListener('input', updateCount);
    updateCount(); // 初始化计数
}

// 添加一个设置当前时间的辅助函数
function setCurrentDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultTime = now.toISOString().slice(0, 16);
    document.getElementById('appointmentTime').value = defaultTime;
}

// 表单提交处理
document.getElementById('repairForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 清除之前的错误提示
    clearErrors();
    
    // 验证表单
    const errors = validateForm();
    if (errors.length > 0) {
        return;
    }
    
    // 显示加载状态
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    
    try {
        const formData = new FormData(this);
        
        // 获取所有预览图片的 base64 数据
        const imagePreview = document.getElementById('imagePreview');
        const images = imagePreview.getElementsByTagName('img');
        
        // 清除之前的照片数据
        formData.delete('photo');
        
        // 将每张图片添加到 FormData
        Array.from(images).forEach((img, index) => {
            // 将 base64 转换回文件
            const imageData = img.src.split(',')[1];
            const mimeType = img.src.split(';')[0].split(':')[1];
            const binaryData = atob(imageData);
            const array = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                array[i] = binaryData.charCodeAt(i);
            }
            const blob = new Blob([array], { type: mimeType });
            const file = new File([blob], `photo${index + 1}.${mimeType.split('/')[1]}`, { type: mimeType });
            
            formData.append('photos', file);
        });
        
        const response = await fetch('/api/submit-repair', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 清除表单
            this.reset();
            // 清除图片预览
            document.getElementById('imagePreview').innerHTML = '';
            // 重置预约时间为当前时间
            setCurrentDateTime();
            
            // 显示成功消息
            showMessage('报修信息提交成功！', 'success');
        } else {
            showMessage(result.message || '提交失败，请重试', 'error');
        }
    } catch (error) {
        showMessage('提交失败，请稍后重试', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// 清除错误提示
function clearErrors() {
    // 清除所有字段错误提示
    document.querySelectorAll('.field-error').forEach(element => {
        element.style.display = 'none';
        element.textContent = '';
    });
    
    // 清除所有字段的错误高亮
    document.querySelectorAll('.error').forEach(field => {
        field.classList.remove('error');
    });
}

// 修改显示消息函数
function showMessage(message, type) {
    const modal = document.getElementById('modalContainer');
    const modalMessage = document.getElementById('modalMessage');
    
    // 设置消息内容和样式
    modalMessage.textContent = message;
    modalMessage.style.color = type === 'success' ? '#2e7d32' : '#c62828';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 点击确定按钮关闭模态框
    document.getElementById('modalClose').onclick = function() {
        modal.style.display = 'none';
    };
    
    // 点击模态框外部也可以关闭
    modal.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 修改图片预览功能
function setupImagePreview() {
    const photoInput = document.getElementById('photo');
    const previewContainer = document.getElementById('imagePreview');
    
    photoInput.addEventListener('change', function() {
        const files = Array.from(this.files);
        
        // 检查总数是否超过5张
        if (files.length + previewContainer.children.length > 5) {
            showMessage('最多只能上传5张图片', 'error');
            this.value = '';
            return;
        }
        
        // 验证每个文件
        for (const file of files) {
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                showMessage('请选择图片文件', 'error');
                this.value = '';
                return;
            }
            
            // 验证文件大小
            if (file.size > 5 * 1024 * 1024) {
                showMessage('单个图片大小不能超过5MB', 'error');
                this.value = '';
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const wrapper = document.createElement('div');
                wrapper.className = 'image-preview-wrapper';
                
                const img = document.createElement('img');
                img.src = e.target.result;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-image';
                deleteBtn.innerHTML = '×';
                deleteBtn.onclick = function() {
                    wrapper.remove();
                    // 更新 FileList
                    updateFileInput();
                };
                
                wrapper.appendChild(img);
                wrapper.appendChild(deleteBtn);
                previewContainer.appendChild(wrapper);
            };
            
            reader.readAsDataURL(file);
        }
    });
}

// 更新文件输入框的值
function updateFileInput() {
    const photoInput = document.getElementById('photo');
    const previewContainer = document.getElementById('imagePreview');
    
    // 如果没有预览图片了，清空文件输入
    if (previewContainer.children.length === 0) {
        photoInput.value = '';
    }
}

// 修改页面加载初始化函数
document.addEventListener('DOMContentLoaded', function() {
    // 使用辅助函数设置初始时间
    setCurrentDateTime();
    
    // 初始化字数统计
    setupCharacterCount('description', 'descriptionCounter', 500);
    
    // 初始化图片预览
    setupImagePreview();
    
    // 添加 ESC 键关闭模态框
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.getElementById('modalContainer').style.display = 'none';
        }
    });
}); 