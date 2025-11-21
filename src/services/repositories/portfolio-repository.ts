// services/repositories/portfolio-repository.ts
// Repository for portfolio data management

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { CachedPortfolioData, PortfolioData } from '@/types/db';
import { getCacheTimes } from '../cache-config';

/**
 * Portfolio Repository
 * Manages user portfolio data caching
 */
class PortfolioRepository extends CachedRepository<CachedPortfolioData, 'id'> {
  protected table = db.portfolioData;
  protected tableName = 'PortfolioRepository';

  /**
   * Cache portfolio data
   */
  async cachePortfolio(
    userId: string,
    type: 'holdings' | 'allocation' | 'performance' | 'history',
    data: PortfolioData
  ): Promise<string> {
    try {
      // Generate ID from userId and type
      const id = `${userId}-${type}`;
      
      const times = getCacheTimes('portfolio');
      
      const cachedPortfolio: CachedPortfolioData = {
        id,
        userId,
        type,
        data,
        lastUpdated: Date.now(),
        ...times,
        syncedAt: Date.now(),
        isDirty: false,
      };

      await this.put(cachedPortfolio);
      
      console.log('[PortfolioRepository] Cached portfolio data:', id);
      return id;
    } catch (error) {
      console.error('[PortfolioRepository] Error caching portfolio:', error);
      throw error;
    }
  }

  /**
   * Get portfolio by user ID and type
   */
  async getByUserIdAndType(
    userId: string,
    type: 'holdings' | 'allocation' | 'performance' | 'history'
  ): Promise<CachedPortfolioData | undefined> {
    const id = `${userId}-${type}`;
    return await this.get(id);
  }

  /**
   * Get all portfolio data for a user
   */
  async getByUserId(userId: string): Promise<CachedPortfolioData[]> {
    try {
      return await this.table
        .where('userId')
        .equals(userId)
        .toArray();
    } catch (error) {
      console.error('[PortfolioRepository] Error getting portfolio by user ID:', error);
      return [];
    }
  }

  /**
   * Get portfolios by type
   */
  async getByType(type: 'holdings' | 'allocation' | 'performance' | 'history'): Promise<CachedPortfolioData[]> {
    try {
      return await this.table
        .where('type')
        .equals(type)
        .toArray();
    } catch (error) {
      console.error('[PortfolioRepository] Error getting portfolios by type:', error);
      return [];
    }
  }

  /**
   * Update portfolio holdings
   */
  async updateHoldings(userId: string, holdings: PortfolioData['holdings']): Promise<void> {
    try {
      const id = `${userId}-holdings`;
      const existing = await this.get(id);
      
      if (!existing) {
        await this.cachePortfolio(userId, 'holdings', { holdings });
        return;
      }

      await this.update(id, {
        data: {
          ...existing.data,
          holdings,
        },
        lastUpdated: Date.now(),
        isDirty: true,
      } as Partial<CachedPortfolioData>);
    } catch (error) {
      console.error('[PortfolioRepository] Error updating holdings:', error);
      throw error;
    }
  }

  /**
   * Update portfolio allocation
   */
  async updateAllocation(userId: string, allocation: PortfolioData['allocation']): Promise<void> {
    try {
      const id = `${userId}-allocation`;
      const existing = await this.get(id);
      
      if (!existing) {
        await this.cachePortfolio(userId, 'allocation', { allocation });
        return;
      }

      await this.update(id, {
        data: {
          ...existing.data,
          allocation,
        },
        lastUpdated: Date.now(),
        isDirty: true,
      } as Partial<CachedPortfolioData>);
    } catch (error) {
      console.error('[PortfolioRepository] Error updating allocation:', error);
      throw error;
    }
  }

  /**
   * Update portfolio performance
   */
  async updatePerformance(userId: string, performance: PortfolioData['performance']): Promise<void> {
    try {
      const id = `${userId}-performance`;
      const existing = await this.get(id);
      
      if (!existing) {
        await this.cachePortfolio(userId, 'performance', { performance });
        return;
      }

      await this.update(id, {
        data: {
          ...existing.data,
          performance,
        },
        lastUpdated: Date.now(),
        isDirty: true,
      } as Partial<CachedPortfolioData>);
    } catch (error) {
      console.error('[PortfolioRepository] Error updating performance:', error);
      throw error;
    }
  }

  /**
   * Get portfolio holdings for a user
   */
  async getHoldings(userId: string): Promise<PortfolioData['holdings'] | undefined> {
    const portfolio = await this.getByUserIdAndType(userId, 'holdings');
    return portfolio?.data.holdings;
  }

  /**
   * Get portfolio allocation for a user
   */
  async getAllocation(userId: string): Promise<PortfolioData['allocation'] | undefined> {
    const portfolio = await this.getByUserIdAndType(userId, 'allocation');
    return portfolio?.data.allocation;
  }

  /**
   * Get portfolio performance for a user
   */
  async getPerformance(userId: string): Promise<PortfolioData['performance'] | undefined> {
    const portfolio = await this.getByUserIdAndType(userId, 'performance');
    return portfolio?.data.performance;
  }

  /**
   * Get all portfolio data for a user (combined)
   */
  async getAllData(userId: string): Promise<{
    holdings?: PortfolioData['holdings'];
    allocation?: PortfolioData['allocation'];
    performance?: PortfolioData['performance'];
  }> {
    try {
      const [holdings, allocation, performance] = await Promise.all([
        this.getHoldings(userId),
        this.getAllocation(userId),
        this.getPerformance(userId),
      ]);

      return {
        holdings,
        allocation,
        performance,
      };
    } catch (error) {
      console.error('[PortfolioRepository] Error getting all portfolio data:', error);
      return {};
    }
  }

  /**
   * Delete all portfolio data for a user
   */
  async deleteByUserId(userId: string): Promise<number> {
    try {
      const portfolios = await this.getByUserId(userId);
      await this.deleteMany(portfolios.map(p => p.id));
      
      console.log(`[PortfolioRepository] Deleted ${portfolios.length} portfolio entries for user ${userId}`);
      return portfolios.length;
    } catch (error) {
      console.error('[PortfolioRepository] Error deleting portfolio by user ID:', error);
      return 0;
    }
  }

  /**
   * Mark portfolio as synced
   */
  async markAsSynced(id: string): Promise<void> {
    try {
      await this.update(id, {
        isDirty: false,
        syncedAt: Date.now(),
      } as Partial<CachedPortfolioData>);
    } catch (error) {
      console.error('[PortfolioRepository] Error marking portfolio as synced:', error);
    }
  }

  /**
   * Get portfolios that need syncing
   */
  async getDirtyPortfolios(): Promise<CachedPortfolioData[]> {
    try {
      const allPortfolios = await this.table.toArray();
      return allPortfolios.filter(portfolio => portfolio.isDirty === true);
    } catch (error) {
      console.error('[PortfolioRepository] Error getting dirty portfolios:', error);
      return [];
    }
  }

  /**
   * Get portfolio statistics
   */
  async getStats(): Promise<{
    totalPortfolios: number;
    byType: Record<string, number>;
    dirtyPortfolios: number;
  }> {
    try {
      const [allPortfolios, dirtyPortfolios] = await Promise.all([
        this.getAll(),
        this.getDirtyPortfolios(),
      ]);

      const byType = allPortfolios.reduce((acc, portfolio) => {
        acc[portfolio.type] = (acc[portfolio.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalPortfolios: allPortfolios.length,
        byType,
        dirtyPortfolios: dirtyPortfolios.length,
      };
    } catch (error) {
      console.error('[PortfolioRepository] Error getting stats:', error);
      return {
        totalPortfolios: 0,
        byType: {},
        dirtyPortfolios: 0,
      };
    }
  }
}

// Export singleton instance
export const portfolioRepository = new PortfolioRepository();

