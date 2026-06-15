"""
Константы для регламентных заданий.
Единственное место определения task_id и статусов — при добавлении нового задания
достаточно обновить этот файл, IDE подскажет все места использования.
"""


class TaskId:
    UPDATE_RNM = 'update_rnm'
    FETCH_EXTERNAL_IP = 'fetch_external_ip'
    BACKUP_SYSTEM = 'backup_system'


class TaskStatus:
    IDLE = 'idle'
    RUNNING = 'running'
    SUCCESS = 'success'
    ERROR = 'error'


# Множество разрешённых task_id — используется для allowlist-проверки в API
ALLOWED_TASKS = {TaskId.UPDATE_RNM, TaskId.FETCH_EXTERNAL_IP, TaskId.BACKUP_SYSTEM}

# Человекочитаемые названия заданий
TASK_NAMES = {
    TaskId.UPDATE_RNM:        'Обновление данных по РНМ',
    TaskId.FETCH_EXTERNAL_IP: 'Получение внешнего IP',
    TaskId.BACKUP_SYSTEM:     'Резервное копирование',
}
