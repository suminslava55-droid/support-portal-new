/**
 * Кастомная тема Ant Design
 * Фирменная палитра вместо стандартной синей
 */

export const customTheme = {
  // Основная фирменная палитра
  token: {
    // Primary цвет - глубокий индиго вместо синего
    colorPrimary: '#4F46E5',
    colorPrimaryHover: '#4338CA',
    colorPrimaryActive: '#3730A3',
    colorPrimaryBg: '#EEF2FF',
    
    // Вторичные цвета
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3B82F6',
    
    // Нейтральные цвета
    colorText: '#1F2937',
    colorTextSecondary: '#6B7280',
    colorTextTertiary: '#9CA3AF',
    
    // Фоны
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F9FAFB',
    colorBgElevated: '#FFFFFF',
    
    // Границы
    colorBorder: '#E5E7EB',
    colorBorderSecondary: '#F3F4F6',
    
    // Типографика
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    
    // Скругления
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    
    // Тени
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    boxShadowTertiary: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    
    // Отступы
    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingMD: 20,
    paddingLG: 24,
    paddingXL: 32,
    
    // Высоты строк
    controlHeight: 36,
    controlHeightSM: 28,
    controlHeightLG: 44,
  },
  
  // Компонент-специфичные настройки
  components: {
    Button: {
      borderRadius: 8,
      paddingInline: 20,
      controlHeight: 40,
      controlHeightSM: 32,
      controlHeightLG: 48,
    },
    Card: {
      borderRadius: 12,
      paddingLG: 24,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    },
    Table: {
      borderRadius: 12,
      padding: 16,
      paddingXS: 8,
      paddingSM: 12,
      headerBg: '#F9FAFB',
      headerColor: '#374151',
      rowHoverBg: '#F3F4F6',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Input: {
      borderRadius: 8,
      paddingInline: 14,
      controlHeight: 40,
      controlHeightSM: 32,
      controlHeightLG: 48,
      activeShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)',
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Modal: {
      borderRadius: 16,
      paddingContentHorizontalLG: 24,
      paddingContentVerticalLG: 24,
    },
    Menu: {
      borderRadius: 8,
      itemBorderRadius: 6,
      itemMarginBlock: 4,
      itemMarginInline: 8,
    },
    Tag: {
      borderRadius: 6,
    },
    Badge: {
      textFontSize: 11,
    },
    Tooltip: {
      borderRadius: 6,
    },
    Popover: {
      borderRadius: 12,
    },
    Drawer: {
      borderRadius: 0,
    },
    Tabs: {
      borderRadius: 8,
      margin: 0,
    },
    Pagination: {
      borderRadius: 6,
    },
    Alert: {
      borderRadius: 8,
    },
    Notification: {
      borderRadius: 12,
    },
    Message: {
      borderRadius: 8,
    },
  },
};

// Темная тема
export const darkTheme = {
  ...customTheme,
  token: {
    ...customTheme.token,
    colorPrimary: '#6366F1',
    colorPrimaryHover: '#818CF8',
    colorPrimaryActive: '#4F46E5',
    colorPrimaryBg: 'rgba(99, 102, 241, 0.15)',
    
    colorText: '#F9FAFB',
    colorTextSecondary: '#D1D5DB',
    colorTextTertiary: '#9CA3AF',
    
    colorBgContainer: '#1F2937',
    colorBgLayout: '#111827',
    colorBgElevated: '#374151',
    
    colorBorder: '#374151',
    colorBorderSecondary: '#4B5563',
    
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
  },
  components: {
    ...customTheme.components,
    Table: {
      ...customTheme.components.Table,
      headerBg: '#374151',
      headerColor: '#F9FAFB',
      rowHoverBg: '#374151',
    },
    Card: {
      ...customTheme.components.Card,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    },
  },
};

export default customTheme;
